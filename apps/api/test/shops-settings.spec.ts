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

  it('syncs installed app snapshot and marks unmatched vendors as suspected unused', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org App Sync' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'appsync.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({
      data: {
        shopifyUserId: 'appsync-owner',
      },
    });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const activeVendor = await prisma.vendor.create({
      data: {
        canonicalName: 'Klaviyo',
        aliases: ['Klaviyo Email'],
      },
    });
    const staleVendor = await prisma.vendor.create({
      data: {
        canonicalName: 'Dormant Analytics',
        aliases: [],
      },
    });
    await prisma.vendorOnShop.createMany({
      data: [
        {
          shopId: shop.id,
          vendorId: activeVendor.id,
        },
        {
          shopId: shop.id,
          vendorId: staleVendor.id,
        },
      ],
    });

    const token = await createSessionToken({
      sub: 'appsync-owner',
      shopDomain: shop.shopifyDomain,
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/shops/${shop.id}/installed-apps/sync`)
      .set('authorization', `Bearer ${token}`)
      .send({
        installedApps: ['Klaviyo'],
        source: 'manual',
      });

    expect(response.status).toBe(201);
    expect(response.body.activeCount).toBe(1);
    expect(response.body.suspectedCount).toBe(1);

    const relations = await prisma.vendorOnShop.findMany({
      where: {
        shopId: shop.id,
      },
      orderBy: {
        vendorId: 'asc',
      },
    });
    const statuses = relations.map((relation) => relation.status).sort();
    expect(statuses).toEqual(['ACTIVE', 'SUSPECTED_UNUSED']);
  });
});
