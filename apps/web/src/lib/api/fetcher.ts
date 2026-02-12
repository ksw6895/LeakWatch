import { getShopifySessionToken } from '../shopify/session-token';

type ApiFetchOptions = RequestInit & {
  host?: string | null;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window !== 'undefined') {
    return trimTrailingSlash(window.location.origin);
  }

  return 'http://localhost:3000';
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const baseUrl = getApiBaseUrl();
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
