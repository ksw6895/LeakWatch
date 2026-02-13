'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { Badge, Box, Button, Card, Layout, Page, Select, Text, TextField } from '@shopify/polaris';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';
import { StatePanel } from '../../../../components/common/StatePanel';
import { navigateEmbedded } from '../../../../lib/navigation/embedded';

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

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function LeaksPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [minSavings, setMinSavings] = useState<string>('0');
  const openCount = useMemo(
    () =>
      findings.filter((finding) => finding.status === 'OPEN' || finding.status === 'REOPENED')
        .length,
    [findings],
  );
  const resolvedCount = useMemo(
    () => findings.filter((finding) => finding.status === 'RESOLVED').length,
    [findings],
  );
  const averageConfidence = useMemo(() => {
    if (findings.length === 0) {
      return 0;
    }
    const total = findings.reduce((sum, finding) => sum + finding.confidence, 0);
    return Math.round(total / findings.length);
  }, [findings]);
  const totalPotential = useMemo(
    () =>
      findings.reduce((sum, finding) => {
        const value = Number.parseFloat(finding.estimatedSavingsAmount);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [findings],
  );
  const displayCurrency = findings[0]?.currency ?? 'USD';
  const typeOptions = useMemo(
    () =>
      ['ALL', ...new Set(findings.map((finding) => finding.type))].map((value) => ({
        label: value,
        value,
      })),
    [findings],
  );
  const filteredFindings = useMemo(() => {
    const threshold = Number.parseFloat(minSavings);
    return findings.filter((finding) => {
      if (statusFilter !== 'ALL' && finding.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== 'ALL' && finding.type !== typeFilter) {
        return false;
      }
      const amount = Number.parseFloat(finding.estimatedSavingsAmount);
      if (
        Number.isFinite(threshold) &&
        threshold > 0 &&
        Number.isFinite(amount) &&
        amount < threshold
      ) {
        return false;
      }
      return true;
    });
  }, [findings, minSavings, statusFilter, typeFilter]);

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

  const openFinding = (findingId: string) => {
    navigateEmbedded(`/app/leaks/${findingId}`, { host, shop });
  };

  return (
    <AppProvider i18n={enTranslations}>
      {appBridgeConfig ? (
        <AppBridgeProvider config={appBridgeConfig}>
          <Page title="Leaks">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="400">
                    <div className="lw-page-stack lw-animate-in">
                      <div className="lw-hero">
                        <span className="lw-eyebrow">Leak Radar</span>
                        <div className="lw-title">
                          <Text as="h2" variant="headingMd">
                            Savings candidates across active subscriptions
                          </Text>
                        </div>
                        <div className="lw-subtitle">
                          <Text as="p" variant="bodySm">
                            Prioritize high-confidence findings before renewal cycles hit.
                          </Text>
                        </div>
                      </div>

                      <div className="lw-summary-grid">
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Open items</div>
                          <div className="lw-metric-value">{openCount}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Resolved</div>
                          <div className="lw-metric-value">{resolvedCount}</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Avg confidence</div>
                          <div className="lw-metric-value">{averageConfidence}%</div>
                        </div>
                        <div className="lw-metric lw-metric--compact">
                          <div className="lw-metric-label">Potential savings</div>
                          <div className="lw-metric-value">
                            {formatCurrency(totalPotential, displayCurrency)}
                          </div>
                        </div>
                      </div>

                      <div className="lw-content-box">
                        <div className="lw-summary-grid">
                          <Select
                            label="Status"
                            options={[
                              { label: 'All statuses', value: 'ALL' },
                              { label: 'OPEN', value: 'OPEN' },
                              { label: 'REOPENED', value: 'REOPENED' },
                              { label: 'RESOLVED', value: 'RESOLVED' },
                              { label: 'DISMISSED', value: 'DISMISSED' },
                            ]}
                            value={statusFilter}
                            onChange={setStatusFilter}
                          />
                          <Select
                            label="Type"
                            options={typeOptions}
                            value={typeFilter}
                            onChange={setTypeFilter}
                          />
                          <TextField
                            label="Min savings"
                            value={minSavings}
                            onChange={setMinSavings}
                            autoComplete="off"
                            suffix={displayCurrency}
                          />
                        </div>
                      </div>

                      {loading ? (
                        <StatePanel
                          kind="loading"
                          message="Loading findings and confidence signals."
                        />
                      ) : error ? (
                        <StatePanel
                          kind="error"
                          message={error}
                          actionLabel="Retry"
                          onAction={() => {
                            window.location.reload();
                          }}
                        />
                      ) : filteredFindings.length === 0 ? (
                        <StatePanel
                          kind="empty"
                          message="No findings match current filters. Try lowering min savings or clearing filters."
                        />
                      ) : (
                        <div className="lw-table-wrap">
                          <table className="lw-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Title</th>
                                <th>Savings</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredFindings.map((finding) => (
                                <tr
                                  key={finding.id}
                                  className="lw-interactive-row"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    openFinding(finding.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      openFinding(finding.id);
                                    }
                                  }}
                                >
                                  <td>
                                    <span className="lw-inline-chip">{finding.type}</span>
                                  </td>
                                  <td>
                                    <Text as="p" variant="bodySm">
                                      {finding.title}
                                    </Text>
                                    <div className="lw-metric-hint">{finding.summary}</div>
                                  </td>
                                  <td>
                                    {finding.estimatedSavingsAmount} {finding.currency}
                                  </td>
                                  <td>
                                    <Badge tone={tone(finding.status)}>{finding.status}</Badge>
                                  </td>
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
                                        accessibilityLabel={`View finding ${finding.title}`}
                                        onClick={() => {
                                          openFinding(finding.id);
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
