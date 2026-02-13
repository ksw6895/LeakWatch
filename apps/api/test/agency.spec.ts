import { OrgRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Agency endpoints', () => {
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

  it('returns org summary and shops list', async () => {
    const org = await prisma.organization.create({ data: { name: 'Agency Org' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'agency-a.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'agency-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const token = await createSessionToken({
      sub: 'agency-owner',
      shopDomain: shop.shopifyDomain,
    });

    const summaryResponse = await request(app.getHttpServer())
      .get(`/v1/orgs/${org.id}/summary`)
      .set('authorization', `Bearer ${token}`);
    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.shopsCount).toBe(1);

    const shopsResponse = await request(app.getHttpServer())
      .get(`/v1/orgs/${org.id}/shops`)
      .set('authorization', `Bearer ${token}`);
    expect(shopsResponse.status).toBe(200);
    expect(Array.isArray(shopsResponse.body)).toBe(true);
  });

  it('creates connect code and attaches another shop', async () => {
    const orgA = await prisma.organization.create({ data: { name: 'Org A' } });
    const orgB = await prisma.organization.create({ data: { name: 'Org B' } });

    const shopA = await prisma.shop.create({
      data: {
        orgId: orgA.id,
        shopifyDomain: 'orga.myshopify.com',
        installedAt: new Date(),
      },
    });

    const shopB = await prisma.shop.create({
      data: {
        orgId: orgB.id,
        shopifyDomain: 'orgb.myshopify.com',
        installedAt: new Date(),
      },
    });

    const user = await prisma.user.create({ data: { shopifyUserId: 'agency-admin' } });
    await prisma.membership.create({
      data: {
        orgId: orgA.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });
    await prisma.membership.create({
      data: {
        orgId: orgB.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const token = await createSessionToken({
      sub: 'agency-admin',
      shopDomain: shopA.shopifyDomain,
    });

    const codeResponse = await request(app.getHttpServer())
      .post(`/v1/orgs/${orgA.id}/connect-codes`)
      .set('authorization', `Bearer ${token}`)
      .send({});
    expect(codeResponse.status).toBe(201);
    expect(String(codeResponse.body.code)).toHaveLength(6);

    const orgBToken = await createSessionToken({
      sub: 'agency-admin',
      shopDomain: shopB.shopifyDomain,
    });

    const attachResponse = await request(app.getHttpServer())
      .post(`/v1/shops/${shopB.id}/connect-code`)
      .set('authorization', `Bearer ${orgBToken}`)
      .send({ code: codeResponse.body.code });
    expect(attachResponse.status).toBe(201);
    expect(attachResponse.body.orgId).toBe(orgA.id);
  });
});
