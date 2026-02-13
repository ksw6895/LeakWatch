import { LeakType, OrgRole, ReportPeriod } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Reports API', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns shop summary', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Summary' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'summary.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'summary-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.MOM_SPIKE,
        title: 'Savings candidate',
        summary: 'summary',
        confidence: 70,
        estimatedSavingsAmount: '25',
        currency: 'USD',
      },
    });

    const token = await createSessionToken({
      sub: 'summary-owner',
      shopDomain: shop.shopifyDomain,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/shops/${shop.id}/summary`)
      .set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('thisMonthSpend');
    expect(response.body).toHaveProperty('potentialSavings');
    expect(response.body).toHaveProperty('topFindings');
  });

  it('queues manual report generation', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Report Queue' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'queue-report.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'report-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const token = await createSessionToken({
      sub: 'report-owner',
      shopDomain: shop.shopifyDomain,
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/reports/generate?shopId=${shop.id}&period=${ReportPeriod.WEEKLY}`)
      .set('authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(201);
    expect(response.body.period).toBe('WEEKLY');
    expect(response.body).toHaveProperty('queuedJobId');
  });

  it('filters report list by period and exports csv payload', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Report Filter' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'report-filter.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'report-filter-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const periodStart = new Date('2026-02-02T00:00:00.000Z');
    const periodEnd = new Date('2026-02-08T23:59:59.999Z');
    const weekly = await prisma.report.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        period: ReportPeriod.WEEKLY,
        periodStart,
        periodEnd,
        summaryJson: {
          totalSpend: '10',
        },
      },
    });
    await prisma.report.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        period: ReportPeriod.MONTHLY,
        periodStart: new Date('2026-02-01T00:00:00.000Z'),
        periodEnd: new Date('2026-02-28T23:59:59.999Z'),
        summaryJson: {
          totalSpend: '99',
        },
      },
    });

    const token = await createSessionToken({
      sub: 'report-filter-owner',
      shopDomain: shop.shopifyDomain,
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/v1/reports?shopId=${shop.id}&period=WEEKLY`)
      .set('authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0]?.period).toBe('WEEKLY');

    const exportResponse = await request(app.getHttpServer())
      .get(`/v1/reports/${weekly.id}/export?format=csv`)
      .set('authorization', `Bearer ${token}`);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.body.contentType).toBe('text/csv; charset=utf-8');
    expect(String(exportResponse.body.content)).toContain('key,value');
  });

  it('creates public share link and fetches shared report', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Report Share' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'report-share.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'report-share-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });
    const report = await prisma.report.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        period: ReportPeriod.WEEKLY,
        periodStart: new Date('2026-02-02T00:00:00.000Z'),
        periodEnd: new Date('2026-02-08T23:59:59.999Z'),
        summaryJson: {
          totalSpend: '77',
        },
      },
    });

    const token = await createSessionToken({
      sub: 'report-share-owner',
      shopDomain: shop.shopifyDomain,
    });

    const shareResponse = await request(app.getHttpServer())
      .post(`/v1/reports/${report.id}/share-link`)
      .set('authorization', `Bearer ${token}`)
      .send({});
    expect(shareResponse.status).toBe(201);
    expect(typeof shareResponse.body.shareUrl).toBe('string');

    const shareUrl = new URL(String(shareResponse.body.shareUrl));
    const shareToken = decodeURIComponent(shareUrl.pathname.split('/').pop() ?? '');
    expect(shareToken.length).toBeGreaterThan(10);

    const sharedResponse = await request(app.getHttpServer()).get(
      `/v1/reports/shared/${shareToken}`,
    );
    expect(sharedResponse.status).toBe(200);
    expect(sharedResponse.body.id).toBe(report.id);

    const sharedExportResponse = await request(app.getHttpServer()).get(
      `/v1/reports/shared/${shareToken}/export?format=json`,
    );
    expect(sharedExportResponse.status).toBe(200);
    expect(sharedExportResponse.body.contentType).toBe('application/json; charset=utf-8');
  });
});
