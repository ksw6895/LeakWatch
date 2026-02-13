import { OrgRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Shop settings API', () => {
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

  it('gets and patches shop settings with currency/timezone/contactEmail', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Settings' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'settings.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({
      data: {
        shopifyUserId: 'settings-owner',
        email: 'owner@example.com',
      },
    });

    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const token = await createSessionToken({
      sub: 'settings-owner',
      shopDomain: shop.shopifyDomain,
    });

    const initial = await request(app.getHttpServer())
      .get(`/v1/shops/${shop.id}/settings`)
      .set('authorization', `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.currency).toBe('USD');
    expect(initial.body.contactEmail).toBe('owner@example.com');

    const patch = await request(app.getHttpServer())
      .patch(`/v1/shops/${shop.id}/settings`)
      .set('authorization', `Bearer ${token}`)
      .send({
        currency: 'EUR',
        timezone: 'Europe/Berlin',
        contactEmail: 'finance@example.com',
      });
    expect(patch.status).toBe(200);
    expect(patch.body.currency).toBe('EUR');
    expect(patch.body.timezone).toBe('Europe/Berlin');
    expect(patch.body.contactEmail).toBe('finance@example.com');

    const updated = await request(app.getHttpServer())
      .get(`/v1/shops/${shop.id}/settings`)
      .set('authorization', `Bearer ${token}`);
    expect(updated.status).toBe(200);
    expect(updated.body.currency).toBe('EUR');
    expect(updated.body.contactEmail).toBe('finance@example.com');
  });
});
