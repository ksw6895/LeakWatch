import { Inject, Injectable } from '@nestjs/common';
import {
  ActionRequestStatus,
  ActionRunStatus,
  ActionType,
  DocStatus,
  FindingStatus,
  OrgRole,
  VendorStatus,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TenantPrismaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listShops(orgId: string) {
    return this.prisma.shop.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getShop(orgId: string, shopId: string) {
    return this.prisma.shop.findFirst({ where: { orgId, id: shopId } });
  }

  async getShopSettings(orgId: string, shopId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { orgId, id: shopId },
      select: {
        id: true,
        currency: true,
        timezone: true,
      },
    });

    if (!shop) {
      return null;
    }

    const settingsLog = await this.prisma.auditLog.findFirst({
      where: {
        orgId,
        shopId,
        action: 'SHOP_SETTINGS_UPDATED',
        targetType: 'shop_settings',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        metaJson: true,
      },
    });

    const metaContactEmail =
      settingsLog &&
      typeof settingsLog.metaJson === 'object' &&
      settingsLog.metaJson !== null &&
      'contactEmail' in settingsLog.metaJson &&
      typeof settingsLog.metaJson.contactEmail === 'string'
        ? settingsLog.metaJson.contactEmail
        : null;

    if (metaContactEmail) {
      return {
        currency: shop.currency,
        timezone: shop.timezone,
        contactEmail: metaContactEmail,
      };
    }

    const owner = await this.prisma.membership.findFirst({
      where: {
        orgId,
        role: OrgRole.OWNER,
      },
      select: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return {
      currency: shop.currency,
      timezone: shop.timezone,
      contactEmail: owner?.user.email ?? null,
    };
  }

  async updateShopSettings(
    orgId: string,
    shopId: string,
    userId: string,
    data: {
      currency?: string;
      timezone?: string;
      contactEmail?: string;
    },
  ) {
    const shop = await this.prisma.shop.findFirst({
      where: { orgId, id: shopId },
      select: {
        id: true,
        currency: true,
        timezone: true,
      },
    });
    if (!shop) {
      return null;
    }

    const updatedShop = await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
      },
      select: {
        currency: true,
        timezone: true,
      },
    });

    const existing = await this.getShopSettings(orgId, shopId);
    const contactEmail = data.contactEmail ?? existing?.contactEmail ?? null;

    await this.prisma.auditLog.create({
      data: {
        orgId,
        shopId,
        userId,
        action: 'SHOP_SETTINGS_UPDATED',
        targetType: 'shop_settings',
        targetId: shopId,
        metaJson: {
          currency: updatedShop.currency,
          timezone: updatedShop.timezone,
          contactEmail,
        },
      },
    });

    return {
      currency: updatedShop.currency,
      timezone: updatedShop.timezone,
      contactEmail,
    };
  }

  async syncInstalledAppsSnapshot(params: {
    orgId: string;
    shopId: string;
    userId: string;
    installedApps: string[];
    source?: string;
  }) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        orgId: params.orgId,
        id: params.shopId,
      },
      select: {
        id: true,
      },
    });
    if (!shop) {
      return null;
    }

    const normalizedInput = new Set(
      params.installedApps
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
    );

    const vendorOnShops = await this.prisma.vendorOnShop.findMany({
      where: {
        shopId: params.shopId,
      },
      include: {
        vendor: {
          select: {
            canonicalName: true,
            aliases: true,
          },
        },
      },
    });

    let activeCount = 0;
    let suspectedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const relation of vendorOnShops) {
        const candidates = [relation.vendor.canonicalName, ...relation.vendor.aliases]
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0);
        const isInstalled = candidates.some((value) => normalizedInput.has(value));

        await tx.vendorOnShop.update({
          where: {
            id: relation.id,
          },
          data: {
            status: isInstalled ? VendorStatus.ACTIVE : VendorStatus.SUSPECTED_UNUSED,
            notes: isInstalled
              ? relation.notes
              : `Snapshot mismatch from ${params.source ?? 'manual'} at ${new Date().toISOString()}`,
          },
        });

        if (isInstalled) {
          activeCount += 1;
        } else {
          suspectedCount += 1;
        }
      }

      await tx.auditLog.create({
        data: {
          orgId: params.orgId,
          shopId: params.shopId,
          userId: params.userId,
          action: 'SHOP_INSTALLED_APPS_SYNCED',
          targetType: 'shop',
          targetId: params.shopId,
          metaJson: {
            source: params.source ?? 'manual',
            installedAppsInputCount: normalizedInput.size,
            installedAppsNormalized: Array.from(normalizedInput).sort(),
            vendorsTracked: vendorOnShops.length,
            activeCount,
            suspectedCount,
          },
        },
      });
    });

    return {
      shopId: params.shopId,
      source: params.source ?? 'manual',
      vendorsTracked: vendorOnShops.length,
      activeCount,
      suspectedCount,
    };
  }

  listDocuments(orgId: string, shopId?: string) {
    return this.prisma.document.findMany({
      where: {
        orgId,
        ...(shopId ? { shopId } : {}),
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getDocument(orgId: string, documentId: string) {
    return this.prisma.document.findFirst({
      where: { orgId, id: documentId },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
  }

  async createDocument(params: {
    orgId: string;
    shopId: string;
    createdByUserId: string;
    vendorHint?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          orgId: params.orgId,
          shopId: params.shopId,
          createdByUserId: params.createdByUserId,
          vendorHint: params.vendorHint ?? null,
        },
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          mimeType: 'application/octet-stream',
          fileName: 'placeholder',
          byteSize: 0,
          sha256: 'pending',
          storageKey: `pending/${document.id}/v1`,
          status: DocStatus.CREATED,
        },
      });

      return document;
    });
  }

  async completeDocument(orgId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({ where: { orgId, id: documentId } });
    if (!document) {
      return null;
    }

    await this.prisma.documentVersion.updateMany({
      where: { documentId: document.id, version: 1 },
      data: { status: DocStatus.UPLOADED },
    });

    return this.getDocument(orgId, documentId);
  }

  listFindings(orgId: string, shopId?: string) {
    return this.prisma.leakFinding.findMany({
      where: {
        orgId,
        ...(shopId ? { shopId } : {}),
      },
      orderBy: [{ estimatedSavingsAmount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getFinding(orgId: string, findingId: string) {
    const finding = await this.prisma.leakFinding.findFirst({
      where: { orgId, id: findingId },
      include: {
        evidence: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!finding) {
      return null;
    }

    const versionIds = finding.evidence
      .map((item) => item.documentVersionId)
      .filter((value): value is string => typeof value === 'string');

    const versionRows =
      versionIds.length > 0
        ? await this.prisma.documentVersion.findMany({
            where: {
              id: {
                in: versionIds,
              },
            },
            select: {
              id: true,
              documentId: true,
              version: true,
            },
          })
        : [];

    const versionMap = new Map(versionRows.map((row) => [row.id, row]));

    return {
      ...finding,
      evidence: finding.evidence.map((item) => {
        const version = item.documentVersionId ? versionMap.get(item.documentVersionId) : undefined;
        return {
          ...item,
          documentId: version?.documentId ?? null,
          documentVersionNumber: version?.version ?? null,
        };
      }),
    };
  }

  async dismissFinding(orgId: string, findingId: string, userId: string) {
    const finding = await this.prisma.leakFinding.findFirst({ where: { orgId, id: findingId } });
    if (!finding) {
      return null;
    }
    const updated = await this.prisma.leakFinding.update({
      where: { id: finding.id },
      data: {
        status: FindingStatus.DISMISSED,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        shopId: finding.shopId,
        userId,
        action: 'FINDING_DISMISSED',
        targetType: 'finding',
        targetId: findingId,
        metaJson: {
          previousStatus: finding.status,
          nextStatus: FindingStatus.DISMISSED,
        },
      },
    });

    return updated;
  }

  async createActionDraft(params: {
    orgId: string;
    shopId: string;
    findingId: string;
    userId: string;
    type: ActionType;
    toEmail: string;
    ccEmails?: string[];
    subject?: string;
    bodyMarkdown?: string;
  }) {
    const finding = await this.prisma.leakFinding.findFirst({
      where: {
        orgId: params.orgId,
        id: params.findingId,
        shopId: params.shopId,
      },
      include: {
        vendor: true,
      },
    });
    if (!finding) {
      return null;
    }

    const actionRequest = await this.prisma.actionRequest.create({
      data: {
        orgId: params.orgId,
        shopId: params.shopId,
        findingId: finding.id,
        type: params.type,
        status: ActionRequestStatus.DRAFT,
        toEmail: params.toEmail,
        ccEmails: params.ccEmails ?? [],
        subject: params.subject ?? `[LeakWatch] ${finding.title}`,
        bodyMarkdown: params.bodyMarkdown ?? finding.summary,
        createdByUserId: params.userId,
      },
    });

    return actionRequest;
  }

  listActionRequests(orgId: string, shopId?: string) {
    return this.prisma.actionRequest
      .findMany({
        where: {
          orgId,
          ...(shopId ? { shopId } : {}),
        },
        include: {
          finding: {
            select: {
              id: true,
              title: true,
              type: true,
              estimatedSavingsAmount: true,
              currency: true,
            },
          },
          runs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      .then((items) =>
        items.map((item) => {
          const latestRunStatus = item.runs[0]?.status ?? null;
          return {
            ...item,
            latestRunStatus,
            displayStatus: this.toActionDisplayStatus(item.status, latestRunStatus),
          };
        }),
      );
  }

  getActionRequest(orgId: string, actionRequestId: string) {
    return this.prisma.actionRequest
      .findFirst({
        where: {
          orgId,
          id: actionRequestId,
        },
        include: {
          finding: {
            select: {
              id: true,
              title: true,
              summary: true,
              type: true,
              confidence: true,
              estimatedSavingsAmount: true,
              currency: true,
            },
          },
          runs: {
            include: {
              mailEvents: {
                orderBy: {
                  occurredAt: 'desc',
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      })
      .then((item) => {
        if (!item) {
          return null;
        }
        const latestRunStatus = item.runs[0]?.status ?? null;
        return {
          ...item,
          latestRunStatus,
          displayStatus: this.toActionDisplayStatus(item.status, latestRunStatus),
        };
      });
  }

  async updateActionManualStatus(
    orgId: string,
    actionRequestId: string,
    status: 'WAITING_REPLY' | 'RESOLVED',
    userId: string,
  ) {
    const actionRequest = await this.prisma.actionRequest.findFirst({
      where: {
        orgId,
        id: actionRequestId,
      },
      select: {
        id: true,
        shopId: true,
      },
    });

    if (!actionRequest) {
      return null;
    }

    const nextRunStatus =
      status === 'RESOLVED' ? ActionRunStatus.RESOLVED : ActionRunStatus.DELIVERED;

    const latestRun = await this.prisma.actionRun.findFirst({
      where: {
        actionRequestId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (latestRun) {
      await this.prisma.actionRun.update({
        where: {
          id: latestRun.id,
        },
        data: {
          status: nextRunStatus,
        },
      });
    } else {
      await this.prisma.actionRun.create({
        data: {
          actionRequestId,
          status: nextRunStatus,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        orgId,
        shopId: actionRequest.shopId,
        userId,
        action: 'ACTION_STATUS_UPDATED',
        targetType: 'action_request',
        targetId: actionRequestId,
        metaJson: {
          requestedStatus: status,
          mappedRunStatus: nextRunStatus,
        },
      },
    });

    return this.getActionRequest(orgId, actionRequestId);
  }

  private toActionDisplayStatus(
    requestStatus: ActionRequestStatus,
    latestRunStatus: ActionRunStatus | null,
  ) {
    if (
      requestStatus === ActionRequestStatus.DRAFT ||
      requestStatus === ActionRequestStatus.CANCELED
    ) {
      return requestStatus;
    }

    if (!latestRunStatus) {
      return requestStatus;
    }

    if (latestRunStatus === ActionRunStatus.RESOLVED) {
      return 'RESOLVED';
    }
    if (latestRunStatus === ActionRunStatus.DELIVERED || latestRunStatus === ActionRunStatus.SENT) {
      return 'WAITING_REPLY';
    }

    return latestRunStatus;
  }

  async updateActionDraft(
    orgId: string,
    actionRequestId: string,
    data: {
      toEmail?: string;
      ccEmails?: string[];
      subject?: string;
      bodyMarkdown?: string;
    },
  ) {
    const actionRequest = await this.prisma.actionRequest.findFirst({
      where: {
        orgId,
        id: actionRequestId,
        status: ActionRequestStatus.DRAFT,
      },
      select: {
        id: true,
      },
    });

    if (!actionRequest) {
      return null;
    }

    return this.prisma.actionRequest.update({
      where: { id: actionRequest.id },
      data: {
        ...(data.toEmail !== undefined ? { toEmail: data.toEmail } : {}),
        ...(data.ccEmails !== undefined ? { ccEmails: data.ccEmails } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.bodyMarkdown !== undefined ? { bodyMarkdown: data.bodyMarkdown } : {}),
      },
    });
  }

  async approveActionRequest(orgId: string, actionRequestId: string, userId: string) {
    const actionRequest = await this.prisma.actionRequest.findFirst({
      where: {
        orgId,
        id: actionRequestId,
      },
      select: {
        id: true,
      },
    });

    if (!actionRequest) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const approved = await tx.actionRequest.update({
        where: {
          id: actionRequest.id,
        },
        data: {
          status: ActionRequestStatus.APPROVED,
          approvedByUserId: userId,
        },
      });

      const actionRun = await tx.actionRun.create({
        data: {
          actionRequestId: approved.id,
          status: ActionRunStatus.QUEUED,
        },
      });

      return {
        actionRequest: approved,
        actionRun,
      };
    });
  }

  listReports(orgId: string, shopId?: string) {
    return this.prisma.report.findMany({
      where: {
        orgId,
        ...(shopId ? { shopId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveActionForFinding(orgId: string, findingId: string, userId: string) {
    const finding = await this.prisma.leakFinding.findFirst({ where: { orgId, id: findingId } });
    if (!finding) {
      return null;
    }

    const existingDraft = await this.prisma.actionRequest.findFirst({
      where: { orgId, findingId, status: ActionRequestStatus.DRAFT },
      orderBy: { createdAt: 'asc' },
    });

    if (existingDraft) {
      return this.prisma.actionRequest.update({
        where: { id: existingDraft.id },
        data: {
          status: ActionRequestStatus.APPROVED,
          approvedByUserId: userId,
        },
      });
    }

    return this.prisma.actionRequest.create({
      data: {
        orgId,
        shopId: finding.shopId,
        findingId,
        type: ActionType.CLARIFICATION,
        status: ActionRequestStatus.APPROVED,
        toEmail: 'finance@example.com',
        ccEmails: [],
        subject: `Action requested for finding ${finding.id}`,
        bodyMarkdown: finding.summary,
        createdByUserId: userId,
        approvedByUserId: userId,
      },
    });
  }
}
