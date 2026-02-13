'use client';

import { Redirect } from '@shopify/app-bridge/actions';
import createApp from '@shopify/app-bridge';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { apiFetch, getApiBaseUrl } from '../lib/api/fetcher';
import { StoreSwitcher } from './StoreSwitcher';

function Content() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const [apiStatus, setApiStatus] = useState<string>('idle');
  const [summary, setSummary] = useState<{
    thisMonthSpend: string;
    potentialSavings: string;
    openActions: number;
    currency: string;
    topFindings: Array<{
      id: string;
      title: string;
      estimatedSavingsAmount: string;
      currency: string;
    }>;
  } | null>(null);

  const authStartUrl = useMemo(() => {
    if (!shop) {
      return null;
    }
    const base = getApiBaseUrl();
    return `${base}/v1/shopify/auth/start?shop=${encodeURIComponent(shop)}`;
  }, [shop]);

  const onAuthenticate = () => {
    if (!authStartUrl) {
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
    if (host && apiKey) {
      const app = createApp({ apiKey, host, forceRedirect: true });
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.REMOTE, authStartUrl);
      return;
    }

    window.location.assign(authStartUrl);
  };

  const onCallApi = async () => {
    try {
      const response = await apiFetch('/v1/auth/me', { host });
      setApiStatus(`${response.status}`);
    } catch {
      setApiStatus('failed');
    }
  };

  useEffect(() => {
    if (!host) {
      return;
    }

    void (async () => {
      try {
        const me = await apiFetch('/v1/auth/me', { host });
        if (!me.ok) {
          return;
        }
        const meJson = (await me.json()) as { shopId: string };
        const response = await apiFetch(`/v1/shops/${meJson.shopId}/summary`, { host });
        if (!response.ok) {
          return;
        }
        const json = (await response.json()) as {
          thisMonthSpend: string;
          potentialSavings: string;
          openActions: number;
          currency: string;
          topFindings: Array<{
            id: string;
            title: string;
            estimatedSavingsAmount: string;
            currency: string;
          }>;
        };
        setSummary(json);
      } catch {
        setSummary(null);
      }
    })();
  }, [host]);

  return (
    <Page title="LeakWatch Embedded App">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Shopify Auth + Embedded Bootstrap
              </Text>
              <Text as="p" variant="bodyMd">
                shop: {shop ?? 'missing'} / host: {host ?? 'missing'}
              </Text>
              <StoreSwitcher host={host} currentShop={shop} />
              <Box paddingBlockStart="300">
                <Button variant="primary" onClick={onAuthenticate} disabled={!shop}>
                  Authenticate Store
                </Button>
              </Box>
              <Box paddingBlockStart="300">
                <Button onClick={onCallApi} disabled={!host}>
                  Call API with Session Token
                </Button>
              </Box>
              <Box paddingBlockStart="300">
                <Button
                  onClick={() => {
                    const next = new URL('/app/uploads', window.location.origin);
                    if (shop) {
                      next.searchParams.set('shop', shop);
                    }
                    if (host) {
                      next.searchParams.set('host', host);
                    }
                    window.location.assign(next.toString());
                  }}
                >
                  Open Uploads Page
                </Button>
              </Box>
              <Box paddingBlockStart="200">
                <Button
                  onClick={() => {
                    const next = new URL('/app/leaks', window.location.origin);
                    if (shop) {
                      next.searchParams.set('shop', shop);
                    }
                    if (host) {
                      next.searchParams.set('host', host);
                    }
                    window.location.assign(next.toString());
                  }}
                >
                  Open Leaks Page
                </Button>
              </Box>
              <Box paddingBlockStart="200">
                <Button
                  onClick={() => {
                    const next = new URL('/app/reports', window.location.origin);
                    if (shop) {
                      next.searchParams.set('shop', shop);
                    }
                    if (host) {
                      next.searchParams.set('host', host);
                    }
                    window.location.assign(next.toString());
                  }}
                >
                  Open Reports Page
                </Button>
              </Box>
              <Box paddingBlockStart="200">
                <Button
                  onClick={() => {
                    const next = new URL('/app/agency', window.location.origin);
                    if (shop) {
                      next.searchParams.set('shop', shop);
                    }
                    if (host) {
                      next.searchParams.set('host', host);
                    }
                    window.location.assign(next.toString());
                  }}
                >
                  Open Agency Dashboard
                </Button>
              </Box>
              <Box paddingBlockStart="200">
                <Button
                  onClick={() => {
                    const next = new URL('/app/settings/billing', window.location.origin);
                    if (shop) {
                      next.searchParams.set('shop', shop);
                    }
                    if (host) {
                      next.searchParams.set('host', host);
                    }
                    window.location.assign(next.toString());
                  }}
                >
                  Open Billing
                </Button>
              </Box>
              <Box paddingBlockStart="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  API call status: {apiStatus}
                </Text>
              </Box>
              {summary && (
                <Box paddingBlockStart="300">
                  <Text as="h3" variant="headingSm">
                    Dashboard Snapshot
                  </Text>
                  <Text as="p" variant="bodySm">
                    Spend: {summary.thisMonthSpend} {summary.currency} / Potential savings:{' '}
                    {summary.potentialSavings} {summary.currency} / Open actions:{' '}
                    {summary.openActions}
                  </Text>
                  <Box paddingBlockStart="200">
                    {summary.topFindings.map((finding) => (
                      <Box key={finding.id} paddingBlockEnd="100">
                        <Badge tone="attention">Top</Badge>{' '}
                        <Text as="span" variant="bodySm">
                          {finding.title} ({finding.estimatedSavingsAmount} {finding.currency})
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function EmbeddedShell() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
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
          <Content />
        </AppBridgeProvider>
      ) : (
        <Content />
      )}
    </AppProvider>
  );
}
