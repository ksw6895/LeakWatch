import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FindingStatus, ReportPeriod } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
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
  ) {}

  listReports(orgId: string, shopId: string) {
    return this.prisma.report.findMany({
      where: { orgId, shopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getReport(orgId: string, reportId: string) {
    return this.prisma.report.findFirst({
      where: { id: reportId, orgId },
    });
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
