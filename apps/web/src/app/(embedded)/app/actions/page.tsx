'use client';

import { Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
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

type InboundParseMetrics = {
  windowDays: number;
  inboundReplyEvents: number;
  labeledFeedback: number;
  labels: {
    TRUE_POSITIVE: number;
    FALSE_POSITIVE: number;
    TRUE_NEGATIVE: number;
    FALSE_NEGATIVE: number;
    UNLABELED: number;
  };
  correctionRate: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
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

function normalizedStatus(item: Pick<ActionRequestListItem, 'status' | 'displayStatus'>): string {
  return item.displayStatus ?? item.status;
}

function ActionsPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const [items, setItems] = useState<ActionRequestListItem[]>([]);
  const [parseMetrics, setParseMetrics] = useState<InboundParseMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusTab, setStatusTab] = useState<
    'ALL' | 'DRAFT' | 'APPROVED' | 'WAITING_REPLY' | 'FAILED' | 'RESOLVED' | 'CANCELED'
  >('ALL');
  const draftsCount = useMemo(
    () => items.filter((item) => normalizedStatus(item) === 'DRAFT').length,
    [items],
  );
  const approvedCount = useMemo(
    () => items.filter((item) => normalizedStatus(item) === 'APPROVED').length,
    [items],
  );
  const canceledCount = useMemo(
    () => items.filter((item) => normalizedStatus(item) === 'CANCELED').length,
    [items],
  );
  const activeRecipients = useMemo(() => new Set(items.map((item) => item.toEmail)).size, [items]);
  const filteredItems = useMemo(
    () =>
      statusTab === 'ALL' ? items : items.filter((item) => normalizedStatus(item) === statusTab),
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
        const metricsResponse = await apiFetch(
          `/v1/action-requests/inbound-parse/metrics?shopId=${encodeURIComponent(me.shopId)}&windowDays=30`,
          {
            host,
          },
        );
        if (!response.ok) {
          throw new Error(`Action requests fetch failed (${response.status})`);
        }
        const json = (await response.json()) as ActionRequestListItem[];
        setItems(json);
        if (metricsResponse.ok) {
          setParseMetrics((await metricsResponse.json()) as InboundParseMetrics);
        }
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [host]);

  const openActionRequest = (actionRequestId: string) => {
    navigateEmbedded(`/app/actions/${actionRequestId}`, { host, shop });
  };

  return (
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

                {parseMetrics ? (
                  <div className="lw-content-box">
                    <Text as="h3" variant="headingSm">
                      Inbound parsing quality (last {parseMetrics.windowDays}d)
                    </Text>
                    <Box paddingBlockStart="200">
                      <div className="lw-summary-grid">
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Inbound replies</div>
                          <div className="lw-metric-value">{parseMetrics.inboundReplyEvents}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Labeled feedback</div>
                          <div className="lw-metric-value">{parseMetrics.labeledFeedback}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">False positives</div>
                          <div className="lw-metric-value">
                            {parseMetrics.labels.FALSE_POSITIVE}
                          </div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">False negatives</div>
                          <div className="lw-metric-value">
                            {parseMetrics.labels.FALSE_NEGATIVE}
                          </div>
                        </div>
                      </div>
                      <Box paddingBlockStart="150">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Correction rate:{' '}
                          {parseMetrics.correctionRate === null
                            ? 'n/a'
                            : `${Math.round(parseMetrics.correctionRate * 100)}%`}
                          {' · '}FP rate:{' '}
                          {parseMetrics.falsePositiveRate === null
                            ? 'n/a'
                            : `${Math.round(parseMetrics.falsePositiveRate * 100)}%`}
                          {' · '}FN rate:{' '}
                          {parseMetrics.falseNegativeRate === null
                            ? 'n/a'
                            : `${Math.round(parseMetrics.falseNegativeRate * 100)}%`}
                        </Text>
                      </Box>
                    </Box>
                  </div>
                ) : null}

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
                  <StatePanel kind="empty" message="No action requests in this status bucket." />
                ) : (
                  <div className="lw-table-wrap">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Swipe horizontally on smaller screens to inspect full action columns.
                    </Text>
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
                          <tr key={item.id}>
                            <td>
                              <Badge tone={tone(normalizedStatus(item))}>
                                {normalizedStatus(item)}
                              </Badge>
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
                              <Button
                                onClick={() => {
                                  openActionRequest(item.id);
                                }}
                              >
                                View detail
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
  );
}

export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsPageContent />
    </Suspense>
  );
}
