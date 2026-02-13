import { DocStatus, FindingStatus, LineItemType, LeakType, type Prisma } from '@prisma/client';
import { createLogger, type RunDetectionJobPayload } from '@leakwatch/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db';
import { processRunDetectionJob } from '../src/jobs/detection';

const logger = createLogger('worker-detection-test');

function invoiceRaw(excerpt: string, amount: string, page = 1) {
  return {
    lineItems: [
      {
        amount,
        evidence: {
          kind: 'PDF_TEXT_SPAN',
          pointer: {
            page,
            lineStart: 1,
            lineEnd: 2,
          },
          excerpt,
        },
      },
    ],
  } satisfies Prisma.InputJsonValue;
}

async function resetDatabase() {
  await prisma.mailEvent.deleteMany();
  await prisma.actionRun.deleteMany();
  await prisma.actionRequest.deleteMany();
  await prisma.evidenceRef.deleteMany();
  await prisma.leakFinding.deleteMany();
  await prisma.vendorOnShop.deleteMany();
  await prisma.normalizedLineItem.deleteMany();
  await prisma.normalizedInvoice.deleteMany();
  await prisma.extractedArtifact.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.shopifyToken.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.vendor.deleteMany();
}

describe.sequential('processRunDetectionJob', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates duplicate and mom spike findings with evidence refs', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Detect' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'detect.myshopify.com',
        installedAt: new Date(),
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        canonicalName: 'Acme Billing',
        aliases: ['Acme Billing'],
      },
    });

    await prisma.vendorOnShop.create({
      data: {
        shopId: shop.id,
        vendorId: vendor.id,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });

    const document = await prisma.document.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        source: 'UPLOAD',
      },
    });

    const prevVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        mimeType: 'application/pdf',
        fileName: 'prev.pdf',
        byteSize: 100,
        sha256: 'a'.repeat(64),
        storageKey: 'docs/prev.pdf',
        status: DocStatus.NORMALIZED,
      },
    });
    const dupVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 2,
        mimeType: 'application/pdf',
        fileName: 'dup.pdf',
        byteSize: 100,
        sha256: 'b'.repeat(64),
        storageKey: 'docs/dup.pdf',
        status: DocStatus.NORMALIZED,
      },
    });
    const payloadVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 3,
        mimeType: 'application/pdf',
        fileName: 'current.pdf',
        byteSize: 100,
        sha256: 'c'.repeat(64),
        storageKey: 'docs/current.pdf',
        status: DocStatus.NORMALIZED,
      },
    });

    const prevInvoice = await prisma.normalizedInvoice.create({
      data: {
        documentVersionId: prevVersion.id,
        vendorId: vendor.id,
        currency: 'USD',
        invoiceDate: new Date('2026-01-15T00:00:00Z'),
        totalAmount: '100',
        rawJson: invoiceRaw('January subscription', '100'),
      },
    });

    const dupInvoice = await prisma.normalizedInvoice.create({
      data: {
        documentVersionId: dupVersion.id,
        vendorId: vendor.id,
        currency: 'USD',
        invoiceDate: new Date('2026-02-10T00:00:00Z'),
        totalAmount: '150',
        rawJson: invoiceRaw('February subscription duplicate', '150', 2),
      },
    });

    const currentInvoice = await prisma.normalizedInvoice.create({
      data: {
        documentVersionId: payloadVersion.id,
        vendorId: vendor.id,
        currency: 'USD',
        invoiceDate: new Date('2026-02-12T00:00:00Z'),
        totalAmount: '150',
        rawJson: invoiceRaw('February subscription duplicate', '150', 3),
      },
    });

    await prisma.normalizedLineItem.createMany({
      data: [
        {
          invoiceId: prevInvoice.id,
          shopId: shop.id,
          vendorId: vendor.id,
          itemType: LineItemType.CHARGE,
          amount: '100',
          currency: 'USD',
          periodStart: new Date('2026-01-01T00:00:00Z'),
          periodEnd: new Date('2026-01-31T00:00:00Z'),
          isRecurring: true,
          recurringCadence: 'MONTHLY',
          description: 'Monthly plan',
        },
        {
          invoiceId: dupInvoice.id,
          shopId: shop.id,
          vendorId: vendor.id,
          itemType: LineItemType.CHARGE,
          amount: '150',
          currency: 'USD',
          periodStart: new Date('2026-02-01T00:00:00Z'),
          periodEnd: new Date('2026-02-28T00:00:00Z'),
          isRecurring: true,
          recurringCadence: 'MONTHLY',
          description: 'Monthly plan',
        },
        {
          invoiceId: currentInvoice.id,
          shopId: shop.id,
          vendorId: vendor.id,
          itemType: LineItemType.CHARGE,
          amount: '150',
          currency: 'USD',
          periodStart: new Date('2026-02-02T00:00:00Z'),
          periodEnd: new Date('2026-02-28T00:00:00Z'),
          isRecurring: true,
          recurringCadence: 'MONTHLY',
          description: 'Monthly plan',
        },
      ],
    });

    const payload: RunDetectionJobPayload = {
      documentVersionId: payloadVersion.id,
      shopId: shop.id,
    };
    const result = await processRunDetectionJob(payload, logger);

    expect(result.ok).toBe(true);
    expect(result.findings).toBeGreaterThanOrEqual(2);

    const findings = await prisma.leakFinding.findMany({
      where: {
        orgId: org.id,
        shopId: shop.id,
      },
      include: {
        evidence: true,
      },
    });
    const findingTypes = new Set(findings.map((finding) => finding.type));
    expect(findingTypes.has('MOM_SPIKE')).toBe(true);
    expect(findingTypes.has('DUPLICATE_CHARGE')).toBe(true);
    for (const finding of findings) {
      expect(finding.evidence.length).toBeGreaterThanOrEqual(2);
    }

    const updatedVersion = await prisma.documentVersion.findUnique({
      where: {
        id: payloadVersion.id,
      },
    });
    expect(updatedVersion?.status).toBe(DocStatus.DETECTED);
  });

  it('reopens dismissed finding when same detection scope appears again', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Reopen' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'reopen.myshopify.com',
        installedAt: new Date(),
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        canonicalName: 'Reopen Vendor',
        aliases: ['Reopen Vendor'],
      },
    });

    await prisma.vendorOnShop.create({
      data: {
        shopId: shop.id,
        vendorId: vendor.id,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });

    const document = await prisma.document.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        source: 'UPLOAD',
      },
    });

    const previousVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        mimeType: 'application/pdf',
        fileName: 'old.pdf',
        byteSize: 100,
        sha256: 'd'.repeat(64),
        storageKey: 'docs/old.pdf',
        status: DocStatus.NORMALIZED,
      },
    });

    const currentVersion = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 2,
        mimeType: 'application/pdf',
        fileName: 'new.pdf',
        byteSize: 100,
        sha256: 'e'.repeat(64),
        storageKey: 'docs/new.pdf',
        status: DocStatus.NORMALIZED,
      },
    });

    const previousInvoice = await prisma.normalizedInvoice.create({
      data: {
        documentVersionId: previousVersion.id,
        vendorId: vendor.id,
        currency: 'USD',
        invoiceDate: new Date('2026-01-10T00:00:00Z'),
        totalAmount: '100',
        rawJson: invoiceRaw('Initial invoice', '100'),
      },
    });

    const currentInvoice = await prisma.normalizedInvoice.create({
      data: {
        documentVersionId: currentVersion.id,
        vendorId: vendor.id,
        currency: 'USD',
        invoiceDate: new Date('2026-02-10T00:00:00Z'),
        totalAmount: '190',
        rawJson: invoiceRaw('Spike invoice', '190'),
      },
    });

    const previousLine = await prisma.normalizedLineItem.create({
      data: {
        invoiceId: previousInvoice.id,
        shopId: shop.id,
        vendorId: vendor.id,
        itemType: LineItemType.CHARGE,
        amount: '100',
        currency: 'USD',
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-01-31T00:00:00Z'),
      },
    });

    await prisma.normalizedLineItem.create({
      data: {
        invoiceId: currentInvoice.id,
        shopId: shop.id,
        vendorId: vendor.id,
        itemType: LineItemType.CHARGE,
        amount: '190',
        currency: 'USD',
        periodStart: new Date('2026-02-01T00:00:00Z'),
        periodEnd: new Date('2026-02-28T00:00:00Z'),
      },
    });

    const dismissed = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.MOM_SPIKE,
        status: FindingStatus.DISMISSED,
        title: 'Old spike',
        summary: 'Previously dismissed',
        confidence: 70,
        estimatedSavingsAmount: '80',
        currency: 'USD',
        vendorId: vendor.id,
        periodStart: previousLine.periodStart,
        periodEnd: previousLine.periodEnd,
      },
    });

    const result = await processRunDetectionJob(
      {
        documentVersionId: currentVersion.id,
        shopId: shop.id,
      },
      logger,
    );

    expect(result.ok).toBe(true);

    const reopened = await prisma.leakFinding.findUnique({ where: { id: dismissed.id } });
    expect(reopened?.status).toBe(FindingStatus.REOPENED);

    const audit = await prisma.auditLog.findFirst({
      where: {
        orgId: org.id,
        action: 'FINDING_REOPENED',
        targetId: dismissed.id,
      },
    });
    expect(audit).toBeTruthy();
  });
});
