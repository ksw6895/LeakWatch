import { randomUUID } from 'node:crypto';

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

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines: string[]): string {
  const normalized = lines.map((line) => line.replace(/[\r\n]+/g, ' ').trim()).filter(Boolean);

  const contentRows = ['BT', '/F1 12 Tf', '72 760 Td'];
  normalized.slice(0, 40).forEach((line, index) => {
    if (index > 0) {
      contentRows.push('0 -16 Td');
    }
    contentRows.push(`(${escapePdfText(line.slice(0, 180))}) Tj`);
  });
  contentRows.push('ET');
  const stream = contentRows.join('\n');

  const object1 = '<< /Type /Catalog /Pages 2 0 R >>';
  const object2 = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  const object3 =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>';
  const object4 = `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
  const object5 = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const objects = [object1, object2, object3, object4, object5];

  const header = '%PDF-1.4\n';
  let body = '';
  let offset = Buffer.byteLength(header, 'utf8');
  const offsets = [0];

  objects.forEach((object, index) => {
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    offsets.push(offset);
    body += chunk;
    offset += Buffer.byteLength(chunk, 'utf8');
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  offsets.slice(1).forEach((value) => {
    xref += `${String(value).padStart(10, '0')} 00000 n \n`;
  });

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return `${header}${body}${xref}${trailer}`;
}

function metaString(meta: unknown, key: string): string | null {
  if (typeof meta !== 'object' || meta === null) {
    return null;
  }
  if (!(key in meta)) {
    return null;
  }
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
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

  async exportReport(orgId: string, reportId: string, format: 'json' | 'csv' | 'pdf') {
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
    format: 'json' | 'csv' | 'pdf',
  ) {
    const stamp = `${report.period.toLowerCase()}-${report.periodStart.toISOString().slice(0, 10)}`;

    if (format === 'json') {
      return {
        fileName: `leakwatch-report-${stamp}.json`,
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify(report.summaryJson, null, 2),
      };
    }

    if (format === 'pdf') {
      const summary = report.summaryJson as Record<string, unknown>;
      const lines = [
        `LeakWatch ${report.period} report`,
        `Period start: ${report.periodStart.toISOString()}`,
        '',
        'Summary',
      ];
      for (const [key, value] of Object.entries(summary).slice(0, 20)) {
        if (Array.isArray(value) || (value && typeof value === 'object')) {
          continue;
        }
        lines.push(`${key}: ${String(value ?? '')}`);
      }

      return {
        fileName: `leakwatch-report-${stamp}.pdf`,
        contentType: 'application/pdf',
        content: buildSimplePdf(lines),
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

  async createShareLink(orgId: string, reportId: string, userId?: string) {
    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const expiresInSec = 60 * 60 * 24 * 7;
    const shareJti = randomUUID();
    const token = await new SignJWT({
      reportId,
      orgId,
      shareJti,
      purpose: 'report_share',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setJti(shareJti)
      .setExpirationTime(`${expiresInSec}s`)
      .setIssuer('leakwatch-api')
      .setAudience('leakwatch-report-share')
      .sign(this.reportShareSecret);

    await this.prisma.auditLog.create({
      data: {
        orgId,
        shopId: report.shopId,
        ...(userId ? { userId } : {}),
        action: 'REPORT_SHARE_LINK_ISSUED',
        targetType: 'report',
        targetId: report.id,
        metaJson: {
          shareJti,
          expiresInSec,
        },
      },
    });

    const shareUrl = `${this.env.SHOPIFY_APP_URL}/reports/shared/${encodeURIComponent(token)}`;
    return {
      shareUrl,
      expiresInSec,
    };
  }

  async revokeShareLink(orgId: string, reportId: string, userId?: string) {
    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const revokedAt = new Date();
    await this.prisma.auditLog.create({
      data: {
        orgId,
        shopId: report.shopId,
        ...(userId ? { userId } : {}),
        action: 'REPORT_SHARE_LINK_REVOKED',
        targetType: 'report',
        targetId: report.id,
        metaJson: {
          revokedAt: revokedAt.toISOString(),
        },
      },
    });

    return {
      reportId: report.id,
      revokedAt,
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
    const shareJti =
      typeof payload.shareJti === 'string'
        ? payload.shareJti
        : typeof payload.jti === 'string'
          ? payload.jti
          : null;
    if (!reportId || !orgId) {
      throw new ForbiddenException('INVALID_SHARE_TOKEN');
    }

    const [latestIssued, latestRevoked] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: {
          orgId,
          targetType: 'report',
          targetId: reportId,
          action: 'REPORT_SHARE_LINK_ISSUED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
          metaJson: true,
        },
      }),
      this.prisma.auditLog.findFirst({
        where: {
          orgId,
          targetType: 'report',
          targetId: reportId,
          action: 'REPORT_SHARE_LINK_REVOKED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    if (latestIssued) {
      const issuedJti = metaString(latestIssued.metaJson, 'shareJti');
      if (!shareJti || !issuedJti || shareJti !== issuedJti) {
        throw new ForbiddenException('SHARE_TOKEN_REVOKED');
      }
      if (latestRevoked && latestRevoked.createdAt.getTime() >= latestIssued.createdAt.getTime()) {
        throw new ForbiddenException('SHARE_TOKEN_REVOKED');
      }
    }

    const report = await this.getReport(orgId, reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async exportSharedReport(token: string, format: 'json' | 'csv' | 'pdf') {
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
