import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import { verifyShopifyQueryHmac, verifyWebhookHmac } from '../src/shopify/hmac';

describe('shopify hmac helpers', () => {
  it('verifies oauth query hmac', () => {
    const secret = 'shpss_test_secret';
    const query = {
      code: 'abc',
      host: 'host',
      shop: 'example.myshopify.com',
      state: 'state',
      timestamp: '1234',
    };

    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key as keyof typeof query]}`)
      .join('&');
    const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');

    expect(verifyShopifyQueryHmac({ ...query, hmac }, secret)).toBe(true);
    expect(verifyShopifyQueryHmac({ ...query, hmac: 'nope' }, secret)).toBe(false);
  });

  it('verifies webhook hmac', () => {
    const secret = 'secret';
    const raw = Buffer.from('{"shop":"example.myshopify.com"}');
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('base64');

    expect(verifyWebhookHmac(raw, signature, secret)).toBe(true);
    expect(verifyWebhookHmac(raw, 'invalid', secret)).toBe(false);
  });
});
