import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FindingStatus, ReportPeriod } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';

import { PrismaService } from '../../common/prisma/prisma.service';
import { getApiEnv } from '../../config/env';
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
  private readonly env = getApiEnv();
  private readonly reportShareSecret = new TextEncoder().encode(this.env.SHOPIFY_API_SECRET);

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

    return this.buildExportPayload(report, format);
  }

  private buildExportPayload(
    report: {
      period: string;
      periodStart: Date;
      summaryJson: unknown;
    },
    format: 'json' | 'csv',
  ) {
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

  async createShareLink(orgId: string, reportId: string) {
    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const expiresInSec = 60 * 60 * 24 * 7;
    const token = await new SignJWT({
      reportId,
      orgId,
      purpose: 'report_share',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expiresInSec}s`)
      .setIssuer('leakwatch-api')
      .setAudience('leakwatch-report-share')
      .sign(this.reportShareSecret);

    const shareUrl = `${this.env.SHOPIFY_APP_URL}/reports/shared/${encodeURIComponent(token)}`;
    return {
      shareUrl,
      expiresInSec,
    };
  }

  async getSharedReport(token: string) {
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      ({ payload } = await jwtVerify(token, this.reportShareSecret, {
        algorithms: ['HS256'],
        issuer: 'leakwatch-api',
        audience: 'leakwatch-report-share',
      }));
    } catch {
      throw new ForbiddenException('INVALID_SHARE_TOKEN');
    }

    if (payload.purpose !== 'report_share') {
      throw new ForbiddenException('INVALID_SHARE_TOKEN_PURPOSE');
    }

    const reportId = typeof payload.reportId === 'string' ? payload.reportId : null;
    const orgId = typeof payload.orgId === 'string' ? payload.orgId : null;
    if (!reportId || !orgId) {
      throw new ForbiddenException('INVALID_SHARE_TOKEN');
    }

    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async exportSharedReport(token: string, format: 'json' | 'csv') {
    const report = await this.getSharedReport(token);
    return this.buildExportPayload(report, format);
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
