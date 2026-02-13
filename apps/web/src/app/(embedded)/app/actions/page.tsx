'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

type ActionRequestListItem = {
  id: string;
  status: string;
  type: string;
  toEmail: string;
  subject: string;
  createdAt: string;
  finding: {
    id: string;
    title: string;
    estimatedSavingsAmount: string;
    currency: string;
  };
};

type AuthMe = {
  shopId: string;
};

function tone(status: string): 'info' | 'success' | 'attention' | 'critical' {
  if (status === 'DRAFT') {
    return 'attention';
  }
  if (status === 'APPROVED') {
    return 'info';
  }
  if (status === 'CANCELED') {
    return 'critical';
  }
  return 'success';
}

function ActionsPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [items, setItems] = useState<ActionRequestListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!host) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const meResponse = await apiFetch('/v1/auth/me', { host });
        if (!meResponse.ok) {
          throw new Error(`Auth check failed (${meResponse.status})`);
        }
        const me = (await meResponse.json()) as AuthMe;
        const response = await apiFetch(
          `/v1/action-requests?shopId=${encodeURIComponent(me.shopId)}`,
          {
            host,
          },
        );
        if (!response.ok) {
          throw new Error(`Action requests fetch failed (${response.status})`);
        }
        const json = (await response.json()) as ActionRequestListItem[];
        setItems(json);
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [host]);

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
          <Page title="Actions">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="400">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Draft, approval, and delivery status of outbound vendor actions
                    </Text>
                    <Box paddingBlockStart="300">
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
                          No action requests yet
                        </Text>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Status</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Type</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Finding</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Recipient</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id}>
                                <td style={{ padding: '8px 0' }}>
                                  <Badge tone={tone(item.status)}>{item.status}</Badge>
                                </td>
                                <td style={{ padding: '8px 0' }}>{item.type}</td>
                                <td style={{ padding: '8px 0' }}>
                                  {item.finding.title} ({item.finding.estimatedSavingsAmount}{' '}
                                  {item.finding.currency})
                                </td>
                                <td style={{ padding: '8px 0' }}>{item.toEmail}</td>
                                <td style={{ padding: '8px 0' }}>
                                  <Button
                                    onClick={() => {
                                      const target = new URL(
                                        `/app/actions/${item.id}`,
                                        window.location.origin,
                                      );
                                      if (host) {
                                        target.searchParams.set('host', host);
                                      }
                                      if (shop) {
                                        target.searchParams.set('shop', shop);
                                      }
                                      window.location.assign(target.toString());
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
                  </Box>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </AppBridgeProvider>
      ) : (
        <Page title="Actions" />
      )}
    </AppProvider>
  );
}

export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsPageContent />
    </Suspense>
  );
}
