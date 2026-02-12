import { Inject, Injectable } from '@nestjs/common';
import { ActionRequestStatus, ActionType, DocStatus, FindingStatus } from '@prisma/client';

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

  getFinding(orgId: string, findingId: string) {
    return this.prisma.leakFinding.findFirst({
      where: { orgId, id: findingId },
      include: {
        evidence: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  async dismissFinding(orgId: string, findingId: string) {
    const finding = await this.prisma.leakFinding.findFirst({ where: { orgId, id: findingId } });
    if (!finding) {
      return null;
    }
    return this.prisma.leakFinding.update({
      where: { id: finding.id },
      data: {
        status: FindingStatus.DISMISSED,
      },
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
