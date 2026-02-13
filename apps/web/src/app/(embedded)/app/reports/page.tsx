'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

type ReportItem = {
  id: string;
  period: 'WEEKLY' | 'MONTHLY';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!host) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const meResponse = await apiFetch('/v1/auth/me', { host });
      if (!meResponse.ok) {
        throw new Error(`Auth failed (${meResponse.status})`);
      }
      const me = (await meResponse.json()) as { shopId: string };
      const response = await apiFetch(`/v1/reports?shopId=${encodeURIComponent(me.shopId)}`, {
        host,
      });
      if (!response.ok) {
        throw new Error(`Reports fetch failed (${response.status})`);
      }
      setItems((await response.json()) as ReportItem[]);
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void load();
  }, [load]);

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const content = (
    <Page
      title="Reports"
      primaryAction={{
        content: 'Generate Monthly',
        onAction: () => {
          if (!host) {
            return;
          }
          void (async () => {
            const meResponse = await apiFetch('/v1/auth/me', { host });
            if (!meResponse.ok) {
              return;
            }
            const me = (await meResponse.json()) as { shopId: string };
            await apiFetch(
              `/v1/reports/generate?shopId=${encodeURIComponent(me.shopId)}&period=MONTHLY`,
              {
                host,
                method: 'POST',
                body: JSON.stringify({}),
              },
            );
            await load();
          })();
        },
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {loading ? (
                <Text as="p" variant="bodyMd">
                  Loading...
                </Text>
              ) : error ? (
                <Text as="p" variant="bodyMd" tone="critical">
                  {error}
                </Text>
              ) : items.length === 0 ? (
                <Text as="p" variant="bodyMd">
                  No reports yet.
                </Text>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>Period</th>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>Range</th>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>Created</th>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ padding: '8px 0' }}>{item.period}</td>
                        <td style={{ padding: '8px 0' }}>
                          {new Date(item.periodStart).toLocaleDateString()} -{' '}
                          {new Date(item.periodEnd).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '8px 0' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 0' }}>
                          <Button
                            onClick={() => {
                              const next = new URL(
                                `/app/reports/${item.id}`,
                                window.location.origin,
                              );
                              if (host) {
                                next.searchParams.set('host', host);
                              }
                              if (shop) {
                                next.searchParams.set('shop', shop);
                              }
                              window.location.assign(next.toString());
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

export default function ReportsPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <ReportsPageContent />
      </AppProvider>
    </Suspense>
  );
}
