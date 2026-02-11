'use client';

import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let appInstance: ReturnType<typeof createApp> | null = null;

export async function getShopifySessionToken(host: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  if (!apiKey || !host) {
    return null;
  }

  if (!appInstance) {
    appInstance = createApp({
      apiKey,
      host,
      forceRedirect: true,
    });
  }

  return getSessionToken(appInstance);
}
