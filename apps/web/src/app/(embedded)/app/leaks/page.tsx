'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

type Finding = {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  confidence: number;
  estimatedSavingsAmount: string;
  currency: string;
  createdAt: string;
};

type AuthMe = {
  shopId: string;
};

function tone(status: string): 'info' | 'success' | 'attention' | 'critical' {
  if (status === 'OPEN' || status === 'REOPENED') {
    return 'critical';
  }
  if (status === 'RESOLVED') {
    return 'success';
  }
  if (status === 'DISMISSED') {
    return 'info';
  }
  return 'attention';
}

function LeaksPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [findings, setFindings] = useState<Finding[]>([]);
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
        const findingsResponse = await apiFetch(`/v1/shops/${me.shopId}/findings`, { host });
        if (!findingsResponse.ok) {
          throw new Error(`Findings fetch failed (${findingsResponse.status})`);
        }
        const json = (await findingsResponse.json()) as Finding[];
        setFindings(json);
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
          <Page title="Leaks">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="400">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Top savings candidates sorted by estimated amount
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
                      ) : findings.length === 0 ? (
                        <Text as="p" variant="bodyMd">
                          No findings yet
                        </Text>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Type</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Title</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Savings</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Status</th>
                              <th style={{ textAlign: 'left', padding: '8px 0' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {findings.map((finding) => (
                              <tr key={finding.id}>
                                <td style={{ padding: '8px 0' }}>{finding.type}</td>
                                <td style={{ padding: '8px 0' }}>{finding.title}</td>
                                <td style={{ padding: '8px 0' }}>
                                  {finding.estimatedSavingsAmount} {finding.currency}
                                </td>
                                <td style={{ padding: '8px 0' }}>
                                  <Badge tone={tone(finding.status)}>{finding.status}</Badge>
                                </td>
                                <td style={{ padding: '8px 0' }}>
                                  <Button
                                    onClick={() => {
                                      const target = new URL(
                                        `/app/leaks/${finding.id}`,
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
        <Page title="Leaks" />
      )}
    </AppProvider>
  );
}

export default function LeaksPage() {
  return (
    <Suspense>
      <LeaksPageContent />
    </Suspense>
  );
}
