import { FindingStatus, LeakType, OrgRole } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Multitenancy + RBAC', () => {
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

  it('blocks orgB from reading orgA finding', async () => {
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

    const userA = await prisma.user.create({ data: { shopifyUserId: 'user-a' } });
    const userB = await prisma.user.create({ data: { shopifyUserId: 'user-b' } });

    await prisma.membership.create({
      data: {
        orgId: orgA.id,
        userId: userA.id,
        role: OrgRole.OWNER,
      },
    });

    await prisma.membership.create({
      data: {
        orgId: orgB.id,
        userId: userB.id,
        role: OrgRole.AGENCY_VIEWER,
      },
    });

    const findingA = await prisma.leakFinding.create({
      data: {
        orgId: orgA.id,
        shopId: shopA.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Duplicate',
        summary: 'Duplicate billing',
        confidence: 88,
        estimatedSavingsAmount: '100',
        currency: 'USD',
      },
    });

    await prisma.leakFinding.create({
      data: {
        orgId: orgB.id,
        shopId: shopB.id,
        type: LeakType.MOM_SPIKE,
        status: FindingStatus.OPEN,
        title: 'Spike',
        summary: 'Monthly spike',
        confidence: 72,
        estimatedSavingsAmount: '50',
        currency: 'USD',
      },
    });

    const tokenB = await createSessionToken({ sub: 'user-b', shopDomain: 'orgb.myshopify.com' });

    const response = await request(app.getHttpServer())
      .get(`/v1/findings/${findingA.id}`)
      .set('authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(response.status);
  });

  it('returns 403 when viewer approves an action', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'viewer.myshopify.com',
        installedAt: new Date(),
      },
    });

    const viewer = await prisma.user.create({ data: { shopifyUserId: 'viewer-sub' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: viewer.id,
        role: OrgRole.AGENCY_VIEWER,
      },
    });

    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.POST_CANCELLATION,
        status: FindingStatus.OPEN,
        title: 'Post cancellation',
        summary: 'Charge after cancellation',
        confidence: 90,
        estimatedSavingsAmount: '70',
        currency: 'USD',
      },
    });

    const token = await createSessionToken({ sub: 'viewer-sub', shopDomain: shop.shopifyDomain });

    const response = await request(app.getHttpServer())
      .post(`/v1/actions/${finding.id}/approve`)
      .set('authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(403);
  });
});
