'use client';

import { Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';
import { navigateEmbedded } from '../../../../lib/navigation/embedded';
import { StatePanel } from '../../../../components/common/StatePanel';

type AgencySummary = {
  shopsCount: number;
  totalSpend: string;
  potentialSavings: string;
  topFindingsAcrossShops: Array<{
    id: string;
    shopId: string;
    title: string;
    estimatedSavingsAmount: string;
    currency: string;
  }>;
};

function AgencyPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const [summary, setSummary] = useState<AgencySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const meResponse = await apiFetch('/v1/auth/me', { host });
        if (!meResponse.ok) {
          throw new Error(`Auth failed (${meResponse.status})`);
        }
        const me = (await meResponse.json()) as { orgId: string };
        const response = await apiFetch(`/v1/orgs/${me.orgId}/summary`, { host });
        if (!response.ok) {
          throw new Error(`Agency summary fetch failed (${response.status})`);
        }
        setSummary((await response.json()) as AgencySummary);
        setError(null);
      } catch (unknownError) {
        setSummary(null);
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [host]);

  return (
    <Page title="Agency dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {!host ? (
                <StatePanel
                  kind="error"
                  message="Missing host context. Re-open LeakWatch from Shopify Admin Apps."
                />
              ) : loading ? (
                <StatePanel
                  kind="loading"
                  message="Loading connected shop rollup and top findings."
                />
              ) : error ? (
                <StatePanel kind="error" message={error} />
              ) : !summary ? (
                <StatePanel kind="empty" message="No agency summary available yet." />
              ) : (
                <div className="lw-page-stack lw-animate-in">
                  <div className="lw-hero">
                    <span className="lw-eyebrow">Agency View</span>
                    <div className="lw-title">
                      <Text as="h2" variant="headingMd">
                        Multi-store leakage and savings overview
                      </Text>
                    </div>
                    <div className="lw-subtitle">
                      <Text as="p" variant="bodySm">
                        Rollup across connected shops with prioritized cross-account findings.
                        Totals represent aggregated shop-level values.
                      </Text>
                    </div>
                  </div>

                  <div className="lw-summary-grid">
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Connected shops</div>
                      <div className="lw-metric-value">{summary.shopsCount}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Total spend</div>
                      <div className="lw-metric-value">{summary.totalSpend}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Potential savings</div>
                      <div className="lw-metric-value">{summary.potentialSavings}</div>
                    </div>
                  </div>

                  <div className="lw-content-box">
                    <div className="lw-title">
                      <Text as="h3" variant="headingSm">
                        Top findings across shops
                      </Text>
                    </div>
                    <Box paddingBlockStart="200">
                      {summary.topFindingsAcrossShops.length === 0 ? (
                        <StatePanel kind="empty" message="No cross-shop findings yet." />
                      ) : (
                        <div className="lw-list">
                          {summary.topFindingsAcrossShops.map((finding) => (
                            <div key={finding.id} className="lw-list-item">
                              <Text as="p" variant="bodySm">
                                [{finding.shopId}] {finding.title}
                              </Text>
                              <div className="lw-metric-hint">
                                {finding.estimatedSavingsAmount} {finding.currency}
                              </div>
                              <Box paddingBlockStart="100">
                                <div className="lw-actions-row">
                                  <Button
                                    onClick={() => {
                                      navigateEmbedded('/app/leaks', { host, shop });
                                    }}
                                  >
                                    Open leaks
                                  </Button>
                                </div>
                              </Box>
                            </div>
                          ))}
                        </div>
                      )}
                    </Box>
                  </div>
                </div>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default function AgencyPage() {
  return (
    <Suspense>
      <AgencyPageContent />
    </Suspense>
  );
}
