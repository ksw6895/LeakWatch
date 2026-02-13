import { OrgRole, Plan } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Billing endpoints', () => {
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

  it('returns current billing and supports subscription update', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Billing Org', plan: Plan.FREE },
    });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'billing.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'billing-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const token = await createSessionToken({
      sub: 'billing-owner',
      shopDomain: shop.shopifyDomain,
    });

    const currentResponse = await request(app.getHttpServer())
      .get(`/v1/billing/current?shopId=${shop.id}`)
      .set('authorization', `Bearer ${token}`);
    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.plan).toBe('FREE');

    const subscribeResponse = await request(app.getHttpServer())
      .post('/v1/billing/subscribe?plan=STARTER')
      .set('authorization', `Bearer ${token}`)
      .send({});
    expect(subscribeResponse.status).toBe(201);
    expect(subscribeResponse.body.plan).toBe('STARTER');
    expect(String(subscribeResponse.body.confirmationUrl)).toContain(
      '/app/settings/billing?status=confirmed&plan=STARTER',
    );
  });
});
