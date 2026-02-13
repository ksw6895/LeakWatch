import {
  ActionRunStatus,
  ActionType,
  DocStatus,
  EvidenceKind,
  FindingStatus,
  LeakType,
  LineItemType,
  type Prisma,
} from '@prisma/client';
import type { RunDetectionJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

import { prisma } from '../db';

const RECENT_WINDOW_DAYS = 90;

type DetectionLineItem = Prisma.NormalizedLineItemGetPayload<{
  include: {
    invoice: {
      include: {
        documentVersion: {
          select: {
            id: true;
          };
        };
      };
    };
    vendor: {
      select: {
        id: true;
        canonicalName: true;
      };
    };
  };
}>;

type EvidenceInput = {
  kind: EvidenceKind;
  pointerJson: Prisma.InputJsonValue;
  excerpt: string;
  documentVersionId: string | null;
};

type FindingDraft = {
  type: LeakType;
  title: string;
  summary: string;
  confidence: number;
  estimatedSavingsAmount: string;
  currency: string;
  vendorId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  primaryLineItemId: string | null;
  evidence: EvidenceInput[];
};

function toAmount(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toMonthKey(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function percentGrowth(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

function roundMoney(value: number): string {
  return value.toFixed(2);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function dateOrNull(value: Date | null | undefined): Date | null {
  return value ?? null;
}

function buildFallbackEvidence(lineItem: DetectionLineItem): EvidenceInput {
  return {
    kind: EvidenceKind.MANUAL_NOTE,
    pointerJson: {
      lineItemId: lineItem.id,
      invoiceId: lineItem.invoiceId,
    },
    excerpt: lineItem.description ?? `Line item ${lineItem.id}`,
    documentVersionId: lineItem.invoice.documentVersion.id,
  };
}

function buildLineItemEvidence(lineItem: DetectionLineItem): EvidenceInput {
  const raw = lineItem.invoice.rawJson as Record<string, unknown>;
  const rawLineItems = Array.isArray(raw.lineItems)
    ? (raw.lineItems as Array<Record<string, unknown>>)
    : [];
  const targetAmount = toAmount(lineItem.amount);

  const matching = rawLineItems.find((candidate) => {
    const amount = Number(candidate.amount);
    const excerpt = normalizeText(
      String((candidate.evidence as { excerpt?: unknown } | undefined)?.excerpt),
    );
    const description = normalizeText(lineItem.description);
    const amountDiff = Math.abs(amount - targetAmount);
    const amountTolerance = Math.max(targetAmount * 0.01, 0.01);
    const excerptMatch = description.length > 0 && excerpt.includes(description.slice(0, 16));
    return amountDiff <= amountTolerance || excerptMatch;
  });

  if (!matching) {
    return buildFallbackEvidence(lineItem);
  }

  const evidence = matching.evidence as {
    kind?: unknown;
    pointer?: Record<string, unknown>;
    excerpt?: unknown;
  };

  const kind =
    evidence.kind === EvidenceKind.CSV_ROW ||
    evidence.kind === EvidenceKind.IMAGE_OCR_LINE ||
    evidence.kind === EvidenceKind.PDF_TEXT_SPAN
      ? evidence.kind
      : EvidenceKind.PDF_TEXT_SPAN;

  return {
    kind,
    pointerJson: {
      documentVersionId: lineItem.invoice.documentVersion.id,
      ...(evidence.pointer ?? {}),
    },
    excerpt:
      typeof evidence.excerpt === 'string' && evidence.excerpt.length > 0
        ? evidence.excerpt
        : (lineItem.description ?? `Line item ${lineItem.id}`),
    documentVersionId: lineItem.invoice.documentVersion.id,
  };
}

function sameDayDistance(left: Date | null | undefined, right: Date | null | undefined): number {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  const diff = Math.abs(left.getTime() - right.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function dedupeEvidence(input: EvidenceInput[]): EvidenceInput[] {
  const seen = new Set<string>();
  const output: EvidenceInput[] = [];
  for (const evidence of input) {
    const key = `${evidence.kind}|${evidence.documentVersionId ?? ''}|${evidence.excerpt}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(evidence);
  }
  return output;
}

function detectDuplicateCharge(lineItems: DetectionLineItem[]): FindingDraft[] {
  const findings: FindingDraft[] = [];
  const chargeItems = lineItems.filter((item) => item.itemType === LineItemType.CHARGE);
  for (const [index, a] of chargeItems.entries()) {
    for (const b of chargeItems.slice(index + 1)) {
      if (!a.vendorId || a.vendorId !== b.vendorId) {
        continue;
      }
      if (a.invoiceId === b.invoiceId) {
        continue;
      }

      const amountA = toAmount(a.amount);
      const amountB = toAmount(b.amount);
      const amountDiff = Math.abs(amountA - amountB);
      const tolerance = Math.max(amountA * 0.01, amountB * 0.01, 0.01);
      if (amountDiff > tolerance) {
        continue;
      }

      const dateA = a.periodStart ?? a.invoice.invoiceDate;
      const dateB = b.periodStart ?? b.invoice.invoiceDate;
      if (sameDayDistance(dateA, dateB) > 2) {
        continue;
      }

      const monthA = toMonthKey(dateA);
      const monthB = toMonthKey(dateB);
      if (!monthA || monthA !== monthB) {
        continue;
      }

      const confidence =
        80 + (amountA === amountB ? 10 : 0) + (sameDayDistance(dateA, dateB) === 0 ? 10 : 0);
      findings.push({
        type: LeakType.DUPLICATE_CHARGE,
        title: `Potential duplicate charge from ${a.vendor?.canonicalName ?? 'vendor'}`,
        summary: `Two charges in the same billing window look duplicated (${roundMoney(amountA)} ${a.currency}).`,
        confidence: Math.min(confidence, 100),
        estimatedSavingsAmount: roundMoney(Math.min(amountA, amountB)),
        currency: a.currency,
        vendorId: a.vendorId,
        periodStart: dateOrNull(dateA),
        periodEnd: dateOrNull(a.periodEnd ?? b.periodEnd ?? null),
        primaryLineItemId: a.id,
        evidence: dedupeEvidence([buildLineItemEvidence(a), buildLineItemEvidence(b)]),
      });
      return findings;
    }
  }
  return findings;
}

function detectMomSpike(lineItems: DetectionLineItem[]): FindingDraft[] {
  const chargeItems = lineItems.filter(
    (item) => item.itemType === LineItemType.CHARGE && item.vendorId,
  );
  const byVendor = new Map<string, DetectionLineItem[]>();
  for (const lineItem of chargeItems) {
    const vendorKey = lineItem.vendorId as string;
    const current = byVendor.get(vendorKey) ?? [];
    current.push(lineItem);
    byVendor.set(vendorKey, current);
  }

  const output: FindingDraft[] = [];
  for (const [vendorId, vendorItems] of byVendor.entries()) {
    const bucket = new Map<string, { total: number; lineItems: DetectionLineItem[] }>();
    for (const item of vendorItems) {
      const date = item.periodStart ?? item.invoice.invoiceDate;
      const month = toMonthKey(date);
      if (!month) {
        continue;
      }
      const existing = bucket.get(month) ?? { total: 0, lineItems: [] };
      existing.total += toAmount(item.amount);
      existing.lineItems.push(item);
      bucket.set(month, existing);
    }

    const months = Array.from(bucket.keys()).sort();
    if (months.length < 2) {
      continue;
    }

    const currentMonth = months.at(-1) as string;
    const prevMonth = months.at(-2) as string;
    const currentData = bucket.get(currentMonth);
    const prevData = bucket.get(prevMonth);
    if (!currentData || !prevData) {
      continue;
    }

    const delta = currentData.total - prevData.total;
    const growth = percentGrowth(currentData.total, prevData.total);
    if (delta < 50 || growth < 50) {
      continue;
    }

    const currentPrimary = [...currentData.lineItems].sort(
      (a, b) => toAmount(b.amount) - toAmount(a.amount),
    )[0];
    const prevPrimary = [...prevData.lineItems].sort(
      (a, b) => toAmount(b.amount) - toAmount(a.amount),
    )[0];
    if (!currentPrimary || !prevPrimary) {
      continue;
    }

    const confidence = 70 + (currentPrimary.periodStart && prevPrimary.periodStart ? 10 : 0);
    output.push({
      type: LeakType.MOM_SPIKE,
      title: `Monthly spend spike for ${currentPrimary.vendor?.canonicalName ?? 'vendor'}`,
      summary: `Monthly charge rose from ${roundMoney(prevData.total)} to ${roundMoney(currentData.total)} (${Math.round(growth)}%).`,
      confidence,
      estimatedSavingsAmount: roundMoney(delta * 0.5),
      currency: currentPrimary.currency,
      vendorId,
      periodStart: dateOrNull(currentPrimary.periodStart ?? currentPrimary.invoice.invoiceDate),
      periodEnd: dateOrNull(currentPrimary.periodEnd),
      primaryLineItemId: currentPrimary.id,
      evidence: dedupeEvidence([
        buildLineItemEvidence(currentPrimary),
        buildLineItemEvidence(prevPrimary),
      ]),
    });
  }

  return output;
}

function detectTrialToPaid(lineItems: DetectionLineItem[]): FindingDraft[] {
  const chargeItems = lineItems.filter(
    (item) => item.itemType === LineItemType.CHARGE && item.vendorId,
  );
  const byVendor = new Map<string, DetectionLineItem[]>();
  for (const item of chargeItems) {
    const key = item.vendorId as string;
    const existing = byVendor.get(key) ?? [];
    existing.push(item);
    byVendor.set(key, existing);
  }

  const findings: FindingDraft[] = [];
  for (const [vendorId, vendorItems] of byVendor.entries()) {
    const sorted = [...vendorItems].sort((a, b) => {
      const left = (a.periodStart ?? a.invoice.invoiceDate)?.getTime() ?? 0;
      const right = (b.periodStart ?? b.invoice.invoiceDate)?.getTime() ?? 0;
      return left - right;
    });
    const firstPaid = sorted.find((item) => toAmount(item.amount) > 0);
    if (!firstPaid) {
      continue;
    }

    const trialToken = /trial|free|14\s*days?/i;
    const textSample = `${firstPaid.description ?? ''} ${buildLineItemEvidence(firstPaid).excerpt}`;
    if (!trialToken.test(textSample)) {
      continue;
    }

    const confidence = 80;
    findings.push({
      type: LeakType.TRIAL_TO_PAID,
      title: `Trial appears to convert to paid for ${firstPaid.vendor?.canonicalName ?? 'vendor'}`,
      summary: `First paid charge contains trial-related wording and may be an unnoticed conversion.`,
      confidence,
      estimatedSavingsAmount: roundMoney(toAmount(firstPaid.amount)),
      currency: firstPaid.currency,
      vendorId,
      periodStart: dateOrNull(firstPaid.periodStart ?? firstPaid.invoice.invoiceDate),
      periodEnd: dateOrNull(firstPaid.periodEnd),
      primaryLineItemId: firstPaid.id,
      evidence: dedupeEvidence([buildLineItemEvidence(firstPaid)]),
    });
  }

  return findings;
}

async function detectPostCancellation(
  shopId: string,
  lineItems: DetectionLineItem[],
): Promise<FindingDraft[]> {
  const cancellationRuns = await prisma.actionRun.findMany({
    where: {
      status: {
        in: [ActionRunStatus.SENT, ActionRunStatus.DELIVERED],
      },
      actionRequest: {
        shopId,
        type: ActionType.CANCEL_REQUEST,
      },
    },
    include: {
      actionRequest: {
        include: {
          finding: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const findings: FindingDraft[] = [];
  for (const run of cancellationRuns) {
    const vendorId = run.actionRequest.finding.vendorId;
    if (!vendorId) {
      continue;
    }

    const matched = lineItems.filter((item) => {
      const date = item.periodStart ?? item.invoice.invoiceDate;
      return (
        item.vendorId === vendorId &&
        toAmount(item.amount) > 0 &&
        date != null &&
        date > run.createdAt
      );
    });

    if (matched.length === 0) {
      continue;
    }

    const latest = matched.sort((a, b) => toAmount(b.amount) - toAmount(a.amount))[0];
    if (!latest) {
      continue;
    }

    const monthlyEstimate = toAmount(latest.amount);
    const confidence = Math.min(95, 75 + (matched.length >= 2 ? 10 : 0));
    findings.push({
      type: LeakType.POST_CANCELLATION,
      title: `Charge detected after cancellation request (${latest.vendor?.canonicalName ?? 'vendor'})`,
      summary: `A recurring charge appeared after a cancellation message was sent.`,
      confidence,
      estimatedSavingsAmount: roundMoney(monthlyEstimate * Math.min(2, matched.length)),
      currency: latest.currency,
      vendorId,
      periodStart: dateOrNull(latest.periodStart ?? latest.invoice.invoiceDate),
      periodEnd: dateOrNull(latest.periodEnd),
      primaryLineItemId: latest.id,
      evidence: dedupeEvidence([
        buildLineItemEvidence(latest),
        {
          kind: EvidenceKind.MANUAL_NOTE,
          pointerJson: {
            actionRunId: run.id,
            actionRequestId: run.actionRequestId,
            sentAt: run.createdAt.toISOString(),
          },
          excerpt: `Cancellation request sent at ${run.createdAt.toISOString()}`,
          documentVersionId: null,
        },
      ]),
    });
    break;
  }

  return findings;
}

async function detectUninstalledAppCharge(
  shopId: string,
  lineItems: DetectionLineItem[],
): Promise<FindingDraft[]> {
  const canceledVendors = await prisma.vendorOnShop.findMany({
    where: {
      shopId,
      status: {
        in: ['CANCELED', 'SUSPECTED_UNUSED'],
      },
    },
    include: {
      vendor: true,
    },
  });

  const findings: FindingDraft[] = [];
  for (const vendorOnShop of canceledVendors) {
    const recentCharge = lineItems
      .filter((item) => item.vendorId === vendorOnShop.vendorId && toAmount(item.amount) > 0)
      .sort((a, b) => {
        const left = (a.periodStart ?? a.invoice.invoiceDate)?.getTime() ?? 0;
        const right = (b.periodStart ?? b.invoice.invoiceDate)?.getTime() ?? 0;
        return right - left;
      })[0];
    if (!recentCharge) {
      continue;
    }

    findings.push({
      type: LeakType.UNINSTALLED_APP_CHARGE,
      title: `Charge found for inactive app vendor ${vendorOnShop.vendor.canonicalName}`,
      summary: `Vendor is marked ${vendorOnShop.status} but charges are still being detected.`,
      confidence: 82,
      estimatedSavingsAmount: roundMoney(toAmount(recentCharge.amount)),
      currency: recentCharge.currency,
      vendorId: vendorOnShop.vendorId,
      periodStart: dateOrNull(recentCharge.periodStart ?? recentCharge.invoice.invoiceDate),
      periodEnd: dateOrNull(recentCharge.periodEnd),
      primaryLineItemId: recentCharge.id,
      evidence: dedupeEvidence([
        buildLineItemEvidence(recentCharge),
        {
          kind: EvidenceKind.MANUAL_NOTE,
          pointerJson: {
            vendorOnShopId: vendorOnShop.id,
            status: vendorOnShop.status,
          },
          excerpt: `Vendor status on shop is ${vendorOnShop.status}`,
          documentVersionId: null,
        },
      ]),
    });
  }

  return findings;
}

async function upsertFinding(
  draft: FindingDraft,
  orgId: string,
  shopId: string,
  logger: pino.Logger,
): Promise<{ findingId: string; created: boolean }> {
  const findingScope: Prisma.LeakFindingWhereInput = {
    orgId,
    shopId,
    type: draft.type,
    status: {
      in: [FindingStatus.OPEN, FindingStatus.REOPENED],
    },
    ...(draft.vendorId ? { vendorId: draft.vendorId } : {}),
    ...(draft.periodStart ? { periodStart: draft.periodStart } : {}),
  };

  const existing = await prisma.leakFinding.findFirst({
    where: findingScope,
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (existing) {
    const updated = await prisma.leakFinding.update({
      where: { id: existing.id },
      data: {
        title: draft.title,
        summary: draft.summary,
        confidence: draft.confidence,
        estimatedSavingsAmount: draft.estimatedSavingsAmount,
        currency: draft.currency,
        periodEnd: draft.periodEnd,
        primaryLineItemId: draft.primaryLineItemId,
      },
    });

    await prisma.evidenceRef.deleteMany({ where: { findingId: updated.id } });
    if (draft.evidence.length > 0) {
      await prisma.evidenceRef.createMany({
        data: draft.evidence.map((evidence) => ({
          findingId: updated.id,
          documentVersionId: evidence.documentVersionId,
          kind: evidence.kind,
          pointerJson: evidence.pointerJson,
          excerpt: evidence.excerpt,
        })),
      });
    }

    return { findingId: updated.id, created: false };
  }

  const closed = await prisma.leakFinding.findFirst({
    where: {
      orgId,
      shopId,
      type: draft.type,
      status: {
        in: [FindingStatus.DISMISSED, FindingStatus.RESOLVED],
      },
      ...(draft.vendorId ? { vendorId: draft.vendorId } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (closed) {
    const reopened = await prisma.leakFinding.update({
      where: { id: closed.id },
      data: {
        status: FindingStatus.REOPENED,
        title: draft.title,
        summary: draft.summary,
        confidence: draft.confidence,
        estimatedSavingsAmount: draft.estimatedSavingsAmount,
        currency: draft.currency,
        periodEnd: draft.periodEnd,
        primaryLineItemId: draft.primaryLineItemId,
      },
    });

    await prisma.evidenceRef.deleteMany({ where: { findingId: reopened.id } });
    if (draft.evidence.length > 0) {
      await prisma.evidenceRef.createMany({
        data: draft.evidence.map((evidence) => ({
          findingId: reopened.id,
          documentVersionId: evidence.documentVersionId,
          kind: evidence.kind,
          pointerJson: evidence.pointerJson,
          excerpt: evidence.excerpt,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        orgId,
        shopId,
        action: 'FINDING_REOPENED',
        targetType: 'finding',
        targetId: reopened.id,
        metaJson: {
          reason: 'Detection rule matched again after dismissed/resolved',
          findingType: draft.type,
        },
      },
    });

    logger.info({ findingId: reopened.id, type: reopened.type }, 'Reopened detection finding');
    return { findingId: reopened.id, created: false };
  }

  const created = await prisma.leakFinding.create({
    data: {
      orgId,
      shopId,
      type: draft.type,
      status: FindingStatus.OPEN,
      title: draft.title,
      summary: draft.summary,
      confidence: draft.confidence,
      estimatedSavingsAmount: draft.estimatedSavingsAmount,
      currency: draft.currency,
      vendorId: draft.vendorId,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      primaryLineItemId: draft.primaryLineItemId,
      evidence: {
        create: draft.evidence.map((evidence) => ({
          documentVersionId: evidence.documentVersionId,
          kind: evidence.kind,
          pointerJson: evidence.pointerJson,
          excerpt: evidence.excerpt,
        })),
      },
    },
  });

  logger.info({ findingId: created.id, type: created.type }, 'Created new detection finding');
  return { findingId: created.id, created: true };
}

async function markDetectionFailure(
  documentVersionId: string,
  errorCode: string,
  errorMessage: string,
  logger: pino.Logger,
) {
  await prisma.documentVersion.update({
    where: { id: documentVersionId },
    data: {
      status: DocStatus.DETECTION_FAILED,
      errorCode,
      errorMessage: errorMessage.slice(0, 900),
    },
  });
  logger.error({ documentVersionId, errorCode, errorMessage }, 'Detection failed');
}

export async function processRunDetectionJob(payload: RunDetectionJobPayload, logger: pino.Logger) {
  const documentVersion = await prisma.documentVersion.findUnique({
    where: {
      id: payload.documentVersionId,
    },
    include: {
      document: true,
    },
  });

  if (!documentVersion || documentVersion.document.shopId !== payload.shopId) {
    return { skipped: true, reason: 'DOCUMENT_VERSION_NOT_FOUND' };
  }

  if (documentVersion.status === DocStatus.DETECTED || documentVersion.status === DocStatus.DONE) {
    return { skipped: true, reason: 'ALREADY_DETECTED' };
  }

  await prisma.documentVersion.update({
    where: { id: documentVersion.id },
    data: {
      status: DocStatus.DETECTION_RUNNING,
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    const from = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const lineItems = await prisma.normalizedLineItem.findMany({
      where: {
        shopId: payload.shopId,
        itemType: LineItemType.CHARGE,
        OR: [{ periodStart: { gte: from } }, { invoice: { invoiceDate: { gte: from } } }],
      },
      include: {
        invoice: {
          include: {
            documentVersion: {
              select: {
                id: true,
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            canonicalName: true,
          },
        },
      },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });

    if (lineItems.length === 0) {
      await prisma.documentVersion.update({
        where: { id: documentVersion.id },
        data: {
          status: DocStatus.DETECTED,
        },
      });
      return { ok: true, findings: 0 };
    }
    const firstLineItem = lineItems[0];
    if (!firstLineItem) {
      return { ok: true, findings: 0 };
    }

    const drafts = [
      ...detectMomSpike(lineItems),
      ...detectDuplicateCharge(lineItems),
      ...detectTrialToPaid(lineItems),
      ...(await detectPostCancellation(payload.shopId, lineItems)),
      ...(await detectUninstalledAppCharge(payload.shopId, lineItems)),
    ]
      .map((draft) => ({
        ...draft,
        evidence:
          draft.evidence.length >= 2
            ? draft.evidence
            : dedupeEvidence([
                ...draft.evidence,
                buildFallbackEvidence(firstLineItem),
                buildFallbackEvidence(lineItems.at(-1) ?? firstLineItem),
              ]),
      }))
      .slice(0, 5);

    const upserts = await Promise.all(
      drafts.map((draft) =>
        upsertFinding(draft, documentVersion.document.orgId, payload.shopId, logger),
      ),
    );

    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: {
        status: DocStatus.DETECTED,
      },
    });

    return {
      ok: true,
      findings: upserts.length,
      created: upserts.filter((value) => value.created).length,
      updated: upserts.filter((value) => !value.created).length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markDetectionFailure(documentVersion.id, 'DETECTION_ENGINE_FAILED', message, logger);
    throw error;
  }
}
