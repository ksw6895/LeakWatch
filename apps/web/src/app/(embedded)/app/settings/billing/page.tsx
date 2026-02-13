'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';

type BillingCurrent = {
  plan: string;
  planStatus: string;
  limits: {
    uploads: number;
    emails: number;
    findings: number;
  };
  usage: {
    uploads: number;
    emails: number;
  };
};

function BillingPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [current, setCurrent] = useState<BillingCurrent | null>(null);

  const refresh = useCallback(async () => {
    if (!host) {
      return;
    }
    const meResponse = await apiFetch('/v1/auth/me', { host });
    if (!meResponse.ok) {
      return;
    }
    const me = (await meResponse.json()) as { shopId: string };
    const response = await apiFetch(`/v1/billing/current?shopId=${encodeURIComponent(me.shopId)}`, {
      host,
    });
    if (!response.ok) {
      return;
    }
    setCurrent((await response.json()) as BillingCurrent);
  }, [host]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const content = (
    <Page title="Billing">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {!current ? (
                <Text as="p" variant="bodyMd">
                  Loading...
                </Text>
              ) : (
                <>
                  <Text as="p" variant="bodyMd">
                    Plan: {current.plan} ({current.planStatus})
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Uploads {current.usage.uploads}/{current.limits.uploads}, Emails{' '}
                    {current.usage.emails}/{current.limits.emails}
                  </Text>
                  <Box paddingBlockStart="300">
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!host) {
                          return;
                        }
                        void (async () => {
                          await apiFetch('/v1/billing/subscribe?plan=STARTER', {
                            host,
                            method: 'POST',
                            body: JSON.stringify({}),
                          });
                          await refresh();
                        })();
                      }}
                    >
                      Upgrade to STARTER
                    </Button>
                  </Box>
                  <Box paddingBlockStart="200">
                    <Button
                      onClick={() => {
                        if (!host) {
                          return;
                        }
                        void (async () => {
                          await apiFetch('/v1/billing/subscribe?plan=PRO', {
                            host,
                            method: 'POST',
                            body: JSON.stringify({}),
                          });
                          await refresh();
                        })();
                      }}
                    >
                      Upgrade to PRO
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );

  return appBridgeConfig ? (
    <AppBridgeProvider config={appBridgeConfig}>{content}</AppBridgeProvider>
  ) : (
    content
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <BillingPageContent />
      </AppProvider>
    </Suspense>
  );
}
