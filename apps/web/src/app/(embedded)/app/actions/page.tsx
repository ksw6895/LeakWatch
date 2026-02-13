'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';
import { StatePanel } from '../../../../components/common/StatePanel';
import { navigateEmbedded } from '../../../../lib/navigation/embedded';

type ActionRequestListItem = {
  id: string;
  status: string;
  displayStatus?: string;
  latestRunStatus?: string | null;
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
  if (status === 'FAILED') {
    return 'critical';
  }
  if (status === 'WAITING_REPLY') {
    return 'attention';
  }
  if (status === 'RESOLVED') {
    return 'success';
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
  const [statusTab, setStatusTab] = useState<
    'ALL' | 'DRAFT' | 'APPROVED' | 'WAITING_REPLY' | 'FAILED' | 'RESOLVED' | 'CANCELED'
  >('ALL');
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
  const filteredItems = useMemo(
    () =>
      statusTab === 'ALL'
        ? items
        : items.filter((item) => (item.displayStatus ?? item.status) === statusTab),
    [items, statusTab],
  );

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

  const openActionRequest = (actionRequestId: string) => {
    navigateEmbedded(`/app/actions/${actionRequestId}`, { host, shop });
  };

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

                      <div className="lw-content-box">
                        <div className="lw-actions-row">
                          {(
                            [
                              'ALL',
                              'DRAFT',
                              'APPROVED',
                              'WAITING_REPLY',
                              'FAILED',
                              'RESOLVED',
                              'CANCELED',
                            ] as const
                          ).map((status) => (
                            <Button
                              key={status}
                              variant={statusTab === status ? 'primary' : 'tertiary'}
                              onClick={() => setStatusTab(status)}
                            >
                              {status}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {loading ? (
                        <StatePanel kind="loading" message="Loading action queue and recipients." />
                      ) : error ? (
                        <StatePanel kind="error" message={error} />
                      ) : filteredItems.length === 0 ? (
                        <StatePanel
                          kind="empty"
                          message="No action requests in this status bucket."
                        />
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
                              {filteredItems.map((item) => (
                                <tr
                                  key={item.id}
                                  className="lw-interactive-row"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    openActionRequest(item.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      openActionRequest(item.id);
                                    }
                                  }}
                                >
                                  <td>
                                    <Badge tone={tone(item.status)}>{item.status}</Badge>
                                    <div className="lw-metric-hint">
                                      display: {item.displayStatus ?? item.status}
                                    </div>
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
                                    <div
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                      onKeyDown={(event) => {
                                        event.stopPropagation();
                                      }}
                                    >
                                      <Button
                                        onClick={() => {
                                          openActionRequest(item.id);
                                        }}
                                      >
                                        View
                                      </Button>
                                    </div>
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
