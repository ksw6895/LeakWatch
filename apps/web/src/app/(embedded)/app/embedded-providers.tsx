'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export function EmbeddedProviders({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  const appBridgeConfig = useMemo(
    () =>
      host && apiKey
        ? {
            apiKey,
            host,
            forceRedirect: true,
          }
        : null,
    [apiKey, host],
  );

  return (
    <AppProvider i18n={enTranslations}>
      {appBridgeConfig ? (
        <AppBridgeProvider config={appBridgeConfig}>{children}</AppBridgeProvider>
      ) : (
        children
      )}
    </AppProvider>
  );
}
