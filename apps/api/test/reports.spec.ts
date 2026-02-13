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
});
