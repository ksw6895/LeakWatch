import { getShopifySessionToken } from '../shopify/session-token';

type ApiFetchOptions = RequestInit & {
  host?: string | null;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const headers = new Headers(options.headers);

  if (options.host) {
    const token = await getShopifySessionToken(options.host);
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  if (!headers.has('content-type') && options.body) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
}
