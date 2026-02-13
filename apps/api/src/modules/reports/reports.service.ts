import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FindingStatus, ReportPeriod } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { QueueService } from '../documents/queue.service';

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getPeriodRange(period: ReportPeriod, now: Date) {
  const today = startOfUtcDay(now);
  if (period === ReportPeriod.MONTHLY) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    return { start, end };
  }

  const weekday = today.getUTCDay();
  const deltaToMonday = (weekday + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - deltaToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QueueService) private readonly queueService: QueueService,
    @Inject(BillingService) private readonly billingService: BillingService,
  ) {}

  listReports(orgId: string, shopId: string, period?: ReportPeriod) {
    return this.prisma.report.findMany({
      where: { orgId, shopId, ...(period ? { period } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  getReport(orgId: string, reportId: string) {
    return this.prisma.report.findFirst({
      where: { id: reportId, orgId },
    });
  }

  async exportReport(orgId: string, reportId: string, format: 'json' | 'csv') {
    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const stamp = `${report.period.toLowerCase()}-${report.periodStart.toISOString().slice(0, 10)}`;

    if (format === 'json') {
      return {
        fileName: `leakwatch-report-${stamp}.json`,
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify(report.summaryJson, null, 2),
      };
    }

    const summary = report.summaryJson as Record<string, unknown>;
    const rows: string[] = ['key,value'];
    for (const [key, value] of Object.entries(summary)) {
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        continue;
      }
      const rendered = String(value ?? '')
        .replace(/"/g, '""')
        .replace(/\n/g, ' ');
      rows.push(`"${key}","${rendered}"`);
    }

    return {
      fileName: `leakwatch-report-${stamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: rows.join('\n'),
    };
  }

  async getSummary(orgId: string, shopId: string) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, orgId } });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const spendAgg = await this.prisma.normalizedLineItem.aggregate({
      where: {
        shopId,
        periodStart: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      _sum: { amount: true },
    });

    const savingsAgg = await this.prisma.leakFinding.aggregate({
      where: {
        orgId,
        shopId,
        status: {
          in: [FindingStatus.OPEN, FindingStatus.REOPENED],
        },
      },
      _sum: { estimatedSavingsAmount: true },
    });

    const openActions = await this.prisma.actionRequest.count({
      where: {
        orgId,
        shopId,
        status: {
          not: 'CANCELED',
        },
      },
    });

    const topFindings = await this.prisma.leakFinding.findMany({
      where: {
        orgId,
        shopId,
        status: {
          in: [FindingStatus.OPEN, FindingStatus.REOPENED],
        },
      },
      orderBy: [{ estimatedSavingsAmount: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        estimatedSavingsAmount: true,
        currency: true,
        createdAt: true,
      },
    });

    return {
      thisMonthSpend: spendAgg._sum.amount ?? '0',
      potentialSavings: savingsAgg._sum.estimatedSavingsAmount ?? '0',
      openActions,
      topFindings,
      currency: shop.currency,
    };
  }

  async enqueueGenerate(
    orgId: string,
    shopId: string,
    period: ReportPeriod,
    options?: { force?: boolean },
  ) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, orgId } });
    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    const reportEntitlement = await this.billingService.canGenerateReport(orgId, shopId);
    if (!reportEntitlement.allowed) {
      throw new ForbiddenException('REPORT_LIMIT_EXCEEDED');
    }

    const { start, end } = getPeriodRange(period, new Date());
    let replacedExisting = false;
    if (options?.force) {
      const deleted = await this.prisma.report.deleteMany({
        where: {
          orgId,
          shopId,
          period,
          periodStart: start,
          periodEnd: end,
        },
      });
      replacedExisting = deleted.count > 0;
    }

    const jobId = await this.queueService.enqueueReportGenerate({
      shopId,
      period,
      trigger: 'manual',
    });

    await this.billingService.incrementUsage(orgId, shopId, 'reports_generated', 1);

    return {
      queuedJobId: jobId,
      period,
      periodStart: start,
      periodEnd: end,
      shopId,
      replacedExisting,
    };
  }
}
