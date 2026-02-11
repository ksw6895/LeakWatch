import crypto from 'crypto';

export function verifyShopifyQueryHmac(
  query: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const hmac = query.hmac;
  if (typeof hmac !== 'string') {
    return false;
  }

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => {
      const value = query[key];
      if (Array.isArray(value)) {
        return `${key}=${value.join(',')}`;
      }
      return `${key}=${value ?? ''}`;
    })
    .join('&');

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const received = Buffer.from(hmac);
  const expected = Buffer.from(digest);
  if (received.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, received);
}

export function verifyWebhookHmac(rawBody: Buffer | string, signature: string, secret: string): boolean {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const received = Buffer.from(signature);
  const expected = Buffer.from(digest);
  if (received.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, received);
}
