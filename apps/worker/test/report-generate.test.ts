import { FindingStatus, LeakType, Plan, ReportPeriod } from '@prisma/client';
import { createLogger, type ReportGenerateJobPayload } from '@leakwatch/shared';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '../src/db';
import { processReportGenerateJob } from '../src/jobs/report-generate';

const logger = createLogger('worker-report-generate-test');

describe.sequential('processReportGenerateJob', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates or updates report row for shop and period', async () => {
    const org = await prisma.organization.create({
      data: {
        name: 'Org Reports',
        plan: Plan.FREE,
      },
    });

    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: `reports-${Date.now()}.myshopify.com`,
        installedAt: new Date(),
      },
    });

    await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Potential duplicate',
        summary: 'Detected duplicate billing pattern',
        confidence: 82,
        estimatedSavingsAmount: '44',
        currency: 'USD',
      },
    });

    const payload: ReportGenerateJobPayload = {
      shopId: shop.id,
      period: ReportPeriod.WEEKLY,
      trigger: 'manual',
    };

    const result = await processReportGenerateJob(payload, logger);
    expect(result.ok).toBe(true);

    const reports = await prisma.report.findMany({ where: { shopId: shop.id } });
    expect(reports.length).toBe(1);
    expect(reports[0]?.period).toBe(ReportPeriod.WEEKLY);
  });
});
