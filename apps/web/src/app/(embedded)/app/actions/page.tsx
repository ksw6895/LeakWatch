'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

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
  const draftsCount = useMemo(
    () => items.filter((item) => item.status === 'DRAFT').length,
    [items],
  );
  const approvedCount = useMemo(
    () => items.filter((item) => item.status === 'APPROVED').length,
    [items],
  );
  const canceledCount = useMemo(
    () => items.filter((item) => item.status === 'CANCELED').length,
    [items],
  );
  const activeRecipients = useMemo(() => new Set(items.map((item) => item.toEmail)).size, [items]);

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
                    <div className="lw-page-stack lw-animate-in">
                      <div className="lw-hero">
                        <span className="lw-eyebrow">Action Queue</span>
                        <div className="lw-title">
                          <Text as="h2" variant="headingMd">
                            Vendor outreach lifecycle: draft, approve, deliver
                          </Text>
                        </div>
                        <div className="lw-subtitle">
                          <Text as="p" variant="bodySm">
                            Track outbound requests linked to leak findings and evidence packs.
                          </Text>
                        </div>
                      </div>

                      <div className="lw-summary-grid">
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Total actions</div>
                          <div className="lw-metric-value">{items.length}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Drafts</div>
                          <div className="lw-metric-value">{draftsCount}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Approved</div>
                          <div className="lw-metric-value">{approvedCount}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Recipients</div>
                          <div className="lw-metric-value">{activeRecipients}</div>
                          <div className="lw-metric-hint">canceled: {canceledCount}</div>
                        </div>
                      </div>

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
                        <div className="lw-table-wrap">
                          <table className="lw-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>Type</th>
                                <th>Finding</th>
                                <th>Recipient</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <Badge tone={tone(item.status)}>{item.status}</Badge>
                                  </td>
                                  <td>
                                    <span className="lw-inline-chip">{item.type}</span>
                                  </td>
                                  <td>
                                    <Text as="p" variant="bodySm">
                                      {item.finding.title}
                                    </Text>
                                    <div className="lw-metric-hint">
                                      {item.finding.estimatedSavingsAmount} {item.finding.currency}
                                    </div>
                                  </td>
                                  <td>{item.toEmail}</td>
                                  <td>
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
                        </div>
                      )}
                    </div>
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
