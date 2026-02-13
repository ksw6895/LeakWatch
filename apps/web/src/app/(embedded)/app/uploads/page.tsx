'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { UploadsPanel } from '../../../../components/uploads-panel';

function UploadsPageContent() {
  const params = useSearchParams();
  const host = params.get('host');
  const shop = params.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  return (
    <AppProvider i18n={enTranslations}>
      {appBridgeConfig ? (
        <AppBridgeProvider config={appBridgeConfig}>
          <UploadsPanel host={host} shop={shop} />
        </AppBridgeProvider>
      ) : (
        <UploadsPanel host={host} shop={shop} />
      )}
    </AppProvider>
  );
}

export default function UploadsPage() {
  return (
    <Suspense>
      <UploadsPageContent />
    </Suspense>
  );
}
