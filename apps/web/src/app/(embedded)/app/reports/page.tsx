'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';
import { StatePanel } from '../../../../components/common/StatePanel';
import { navigateEmbedded } from '../../../../lib/navigation/embedded';

type ReportItem = {
  id: string;
  period: 'WEEKLY' | 'MONTHLY';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const monthlyCount = useMemo(
    () => items.filter((item) => item.period === 'MONTHLY').length,
    [items],
  );
  const weeklyCount = useMemo(
    () => items.filter((item) => item.period === 'WEEKLY').length,
    [items],
  );
  const latestGeneratedAt = useMemo(
    () =>
      items.reduce<string | null>((latest, item) => {
        if (!latest) {
          return item.createdAt;
        }
        return new Date(item.createdAt).getTime() > new Date(latest).getTime()
          ? item.createdAt
          : latest;
      }, null),
    [items],
  );

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

  const generateMonthly = useCallback(async () => {
    if (!host) {
      return;
    }
    setGenerating(true);
    try {
      const meResponse = await apiFetch('/v1/auth/me', { host });
      if (!meResponse.ok) {
        return;
      }
      const me = (await meResponse.json()) as { shopId: string };
      const generateResponse = await apiFetch(
        `/v1/reports/generate?shopId=${encodeURIComponent(me.shopId)}&period=MONTHLY&force=true`,
        {
          host,
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      if (!generateResponse.ok) {
        return;
      }
      await load();
      window.setTimeout(() => {
        void load();
      }, 1200);
    } finally {
      setGenerating(false);
    }
  }, [host, load]);

  const content = (
    <Page
      title="Reports"
      primaryAction={{
        content: 'Generate Monthly',
        onAction: () => void generateMonthly(),
        loading: generating,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <div className="lw-page-stack lw-animate-in">
                <div className="lw-hero">
                  <span className="lw-eyebrow">Report Hub</span>
                  <div className="lw-title">
                    <Text as="h2" variant="headingMd">
                      Generated intelligence for billing and leakage trends
                    </Text>
                  </div>
                  <div className="lw-subtitle">
                    <Text as="p" variant="bodySm">
                      Trigger monthly snapshots and drill into period-level summaries.
                    </Text>
                  </div>
                </div>

                <div className="lw-summary-grid">
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Total reports</div>
                    <div className="lw-metric-value">{items.length}</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Monthly</div>
                    <div className="lw-metric-value">{monthlyCount}</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Weekly</div>
                    <div className="lw-metric-value">{weeklyCount}</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Last generated</div>
                    <div className="lw-metric-value">
                      {latestGeneratedAt ? formatUtcDate(latestGeneratedAt) : 'n/a'}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <StatePanel kind="loading" message="Loading weekly and monthly reports." />
                ) : error ? (
                  <StatePanel kind="error" message={error} />
                ) : items.length === 0 ? (
                  <StatePanel
                    kind="empty"
                    message="No reports yet. Generate monthly report to start benchmarking."
                  />
                ) : (
                  <div className="lw-table-wrap">
                    <table className="lw-table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Range</th>
                          <th>Generated</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <span className="lw-inline-chip">{item.period}</span>
                            </td>
                            <td>
                              {formatUtcDate(item.periodStart)} - {formatUtcDate(item.periodEnd)}
                            </td>
                            <td>{new Date(item.createdAt).toLocaleString()}</td>
                            <td>
                              <Button
                                onClick={() => {
                                  navigateEmbedded(`/app/reports/${item.id}`, { host, shop });
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
