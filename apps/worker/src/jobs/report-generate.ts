import { Plan, ReportPeriod } from '@prisma/client';
import type { ReportGenerateJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

import { prisma } from '../db';
import { getWorkerEnv } from '../env';

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
    const prevStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const prevEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999),
    );
    return { start, end, prevStart, prevEnd };
  }

  const weekday = today.getUTCDay();
  const deltaToMonday = (weekday + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - deltaToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  const prevStart = new Date(start);
  prevStart.setUTCDate(start.getUTCDate() - 7);
  const prevEnd = new Date(end);
  prevEnd.setUTCDate(end.getUTCDate() - 7);

  return { start, end, prevStart, prevEnd };
}

async function maybeSendReportEmail(args: {
  orgId: string;
  shopId: string;
  shopDomain: string;
  reportId: string;
  period: ReportPeriod;
}) {
  const env = getWorkerEnv();
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    return { sent: false, reason: 'MAILGUN_NOT_CONFIGURED' as const };
  }

  const owner = await prisma.membership.findFirst({
    where: {
      orgId: args.orgId,
      role: 'OWNER',
      user: {
        email: {
          not: null,
        },
      },
    },
    include: {
      user: true,
    },
  });

  if (!owner?.user.email) {
    return { sent: false, reason: 'OWNER_EMAIL_NOT_SET' as const };
  }

  const appUrl = process.env.SHOPIFY_APP_URL ?? 'http://localhost:3000';
  const reportUrl = `${appUrl}/app/reports`;
  const subject = `[LeakWatch] ${args.period.toLowerCase()} report ready`;
  const text = `Your ${args.period.toLowerCase()} report for ${args.shopDomain} is ready.\n\nOpen: ${reportUrl}`;
  const html = `<p>Your <strong>${args.period.toLowerCase()}</strong> report for <strong>${args.shopDomain}</strong> is ready.</p><p><a href="${reportUrl}">Open report list</a></p>`;

  const form = new FormData();
  form.set('from', `LeakWatch <noreply@${env.MAILGUN_DOMAIN}>`);
  form.set('to', owner.user.email);
  form.set('subject', subject);
  form.set('text', text);
  form.set('html', html);

  const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64')}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    return { sent: false, reason: `MAILGUN_SEND_FAILED:${response.status}:${body}` as const };
  }

  const day = startOfUtcDay(new Date());
  await prisma.usageCounter.upsert({
    where: {
      orgId_shopId_day_metric: {
        orgId: args.orgId,
        shopId: args.shopId,
        day,
        metric: 'report_emails_sent',
      },
    },
    create: {
      orgId: args.orgId,
      shopId: args.shopId,
      day,
      metric: 'report_emails_sent',
      value: BigInt(1),
    },
    update: {
      value: {
        increment: BigInt(1),
      },
    },
  });

  return { sent: true, reason: null };
}

export async function processReportGenerateJob(
  payload: ReportGenerateJobPayload,
  logger: pino.Logger,
) {
  const shop = await prisma.shop.findUnique({
    where: { id: payload.shopId },
    include: { org: true },
  });

  if (!shop || shop.uninstalledAt) {
    return { skipped: true, reason: 'SHOP_NOT_FOUND' };
  }

  const period = payload.period === 'WEEKLY' ? ReportPeriod.WEEKLY : ReportPeriod.MONTHLY;
  const range = getPeriodRange(period, new Date());

  const spend = await prisma.normalizedLineItem.aggregate({
    where: {
      shopId: shop.id,
      periodStart: {
        gte: range.start,
        lte: range.end,
      },
    },
    _sum: { amount: true },
  });

  const prevSpend = await prisma.normalizedLineItem.aggregate({
    where: {
      shopId: shop.id,
      periodStart: {
        gte: range.prevStart,
        lte: range.prevEnd,
      },
    },
    _sum: { amount: true },
  });

  const topFindings = await prisma.leakFinding.findMany({
    where: {
      orgId: shop.orgId,
      shopId: shop.id,
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    orderBy: [{ estimatedSavingsAmount: 'desc' }, { createdAt: 'desc' }],
    take: 5,
    select: {
      id: true,
      type: true,
      title: true,
      estimatedSavingsAmount: true,
      currency: true,
    },
  });

  const topVendors = await prisma.vendorOnShop.findMany({
    where: { shopId: shop.id },
    include: { vendor: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 5,
  });

  const summaryJson = {
    totalSpend: spend._sum.amount ?? '0',
    prevTotalSpend: prevSpend._sum.amount ?? '0',
    deltaVsPrev: Number(spend._sum.amount ?? 0) - Number(prevSpend._sum.amount ?? 0),
    topVendors: topVendors.map((entry) => ({
      id: entry.vendorId,
      canonicalName: entry.vendor.canonicalName,
      status: entry.status,
    })),
    topFindings,
    trigger: payload.trigger,
  };

  const report = await prisma.report.upsert({
    where: {
      shopId_period_periodStart_periodEnd: {
        shopId: shop.id,
        period,
        periodStart: range.start,
        periodEnd: range.end,
      },
    },
    create: {
      orgId: shop.orgId,
      shopId: shop.id,
      period,
      periodStart: range.start,
      periodEnd: range.end,
      summaryJson,
    },
    update: {
      summaryJson,
    },
  });

  const shouldSendEmail = shop.org.plan === Plan.STARTER || shop.org.plan === Plan.PRO;
  const emailResult = shouldSendEmail
    ? await maybeSendReportEmail({
        orgId: shop.orgId,
        shopId: shop.id,
        shopDomain: shop.shopifyDomain,
        reportId: report.id,
        period,
      })
    : { sent: false, reason: 'PLAN_FREE' as const };

  logger.info(
    {
      reportId: report.id,
      orgId: shop.orgId,
      shopId: shop.id,
      period,
      emailSent: emailResult.sent,
      emailReason: emailResult.reason,
    },
    'Report generated',
  );

  return {
    ok: true,
    reportId: report.id,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
  };
}
