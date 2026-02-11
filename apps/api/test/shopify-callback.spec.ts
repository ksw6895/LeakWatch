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
});
