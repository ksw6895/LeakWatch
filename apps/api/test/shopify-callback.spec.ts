import { createHmac } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Shopify OAuth callback guards', () => {
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

  it('returns 401 for missing/invalid state', async () => {
    const response = await request(app.getHttpServer()).get('/v1/shopify/auth/callback').query({
      code: 'code',
      shop: 'example.myshopify.com',
      state: 'invalid-state',
      hmac: 'abc',
    });

    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('INVALID_OR_EXPIRED_OAUTH_STATE');
    expect(response.body.message).toBe('Invalid or expired OAuth state');
  });

  it('returns 401 when hmac is invalid even with valid state', async () => {
    const start = await request(app.getHttpServer())
      .get('/v1/shopify/auth/start')
      .query({ shop: 'example.myshopify.com' });

    expect(start.status).toBe(302);
    const location = start.headers.location as string;
    const state = new URL(location).searchParams.get('state');
    expect(state).toBeTruthy();

    const response = await request(app.getHttpServer()).get('/v1/shopify/auth/callback').query({
      code: 'code',
      shop: 'example.myshopify.com',
      state,
      hmac: 'invalid',
    });

    expect(response.status).toBe(401);
  });

  it('accepts shop-update webhook and syncs shop metadata', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Shop Update' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'shop-update.myshopify.com',
        installedAt: new Date(),
      },
    });

    const rawPayload = JSON.stringify({
      name: 'Shop Update Name',
      currency: 'EUR',
      iana_timezone: 'Europe/Berlin',
    });
    const secret = process.env.SHOPIFY_API_SECRET ?? 'test_secret';
    const signature = createHmac('sha256', secret).update(rawPayload).digest('base64');

    const response = await request(app.getHttpServer())
      .post('/v1/shopify/webhooks/shop-update')
      .set('content-type', 'application/json')
      .set('x-shopify-hmac-sha256', signature)
      .set('x-shopify-shop-domain', shop.shopifyDomain)
      .send(rawPayload);

    expect(response.status).toBe(201);

    const updated = await prisma.shop.findUnique({ where: { id: shop.id } });
    expect(updated?.displayName).toBe('Shop Update Name');
    expect(updated?.currency).toBe('EUR');
    expect(updated?.timezone).toBe('Europe/Berlin');
  });
});
