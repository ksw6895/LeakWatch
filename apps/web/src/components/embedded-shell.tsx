'use client';

import { Redirect } from '@shopify/app-bridge/actions';
import createApp from '@shopify/app-bridge';
import { Badge, Box, Card, Layout, Page, Text } from '@shopify/polaris';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { apiFetch, getApiBaseUrl } from '../lib/api/fetcher';
import { trackEvent } from '../lib/analytics/track';
import { navigateEmbedded } from '../lib/navigation/embedded';
import { StatePanel } from './common/StatePanel';
import { ActionTile } from './dashboard/ActionTile';
import { MetricCard } from './dashboard/MetricCard';
import { StatusWidget } from './dashboard/StatusWidget';
import { StoreSwitcher } from './StoreSwitcher';

type Summary = {
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

function Content() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');
  const [apiStatus, setApiStatus] = useState<string>('idle');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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

  const goTo = (path: string) => {
    void trackEvent(host, 'dashboard_quick_action_clicked', {
      host,
      shop,
      targetPath: path,
    });
    navigateEmbedded(path, { host, shop });
  };

  useEffect(() => {
    if (!host) {
      setSummaryError(
        'Missing host parameter. Re-open this app from Shopify Admin to restore session.',
      );
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
          setSummaryError(`Summary fetch failed (${response.status})`);
          return;
        }
        const json = (await response.json()) as Summary;
        setSummary(json);
        setSummaryError(null);
      } catch {
        setSummary(null);
        setSummaryError('Unable to load dashboard summary right now.');
      }
    })();
  }, [host]);

  const snapshot = summary
    ? [
        {
          label: 'Monthly spend',
          value: `${summary.thisMonthSpend} ${summary.currency}`,
        },
        {
          label: 'Potential savings',
          value: `${summary.potentialSavings} ${summary.currency}`,
        },
        {
          label: 'Open actions',
          value: `${summary.openActions}`,
        },
      ]
    : [];

  const quickActions = [
    {
      label: 'Uploads',
      path: '/app/uploads',
      hint: 'Invoice evidence ingestion',
    },
    {
      label: 'Leaks',
      path: '/app/leaks',
      hint: 'Highest savings opportunities',
    },
    {
      label: 'Reports',
      path: '/app/reports',
      hint: 'Monthly and weekly snapshots',
    },
    {
      label: 'Actions',
      path: '/app/actions',
      hint: 'Vendor outreach queue',
    },
    {
      label: 'Agency',
      path: '/app/agency',
      hint: 'Org-wide fleet visibility',
    },
    {
      label: 'Billing',
      path: '/app/settings/billing',
      hint: 'Plan usage and upgrades',
    },
  ];

  return (
    <Page title="LeakWatch Command Center">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <div className="lw-page-stack lw-animate-in">
                <div className="lw-shell">
                  <StatusWidget
                    shop={shop}
                    host={host}
                    apiStatus={apiStatus}
                    onAuthenticate={onAuthenticate}
                    onCallApi={onCallApi}
                  />
                </div>

                {summaryError ? (
                  <StatePanel
                    kind="error"
                    title="Session or summary issue"
                    message={summaryError}
                    actionLabel="Retry API check"
                    onAction={() => {
                      void onCallApi();
                    }}
                  />
                ) : null}

                {summary ? (
                  <div className="lw-surface">
                    <Box padding="300">
                      <div className="lw-title">
                        <Text as="h3" variant="headingSm">
                          Dashboard Snapshot
                        </Text>
                      </div>
                      <Box paddingBlockStart="200">
                        <div className="lw-summary-grid">
                          {snapshot.map((item) => (
                            <MetricCard key={item.label} label={item.label} value={item.value} />
                          ))}
                        </div>
                      </Box>
                      <Box paddingBlockStart="200">
                        <div className="lw-list">
                          {summary.topFindings.map((finding) => (
                            <div key={finding.id} className="lw-list-item">
                              <Badge tone="attention">Top finding</Badge>{' '}
                              <Text as="span" variant="bodySm">
                                {finding.title} ({finding.estimatedSavingsAmount} {finding.currency}
                                )
                              </Text>
                            </div>
                          ))}
                        </div>
                      </Box>
                    </Box>
                  </div>
                ) : (
                  <StatePanel
                    kind="empty"
                    title="No summary yet"
                    message="Authenticate and upload billing evidence to populate your command center."
                  />
                )}

                <div className="lw-surface">
                  <Box padding="300">
                    <div className="lw-title">
                      <Text as="h3" variant="headingSm">
                        Quick actions
                      </Text>
                    </div>
                    <Box paddingBlockStart="200">
                      <div className="lw-action-grid">
                        {quickActions.map((action) => (
                          <ActionTile
                            key={action.path}
                            label={action.label}
                            hint={action.hint}
                            onClick={() => goTo(action.path)}
                          />
                        ))}
                      </div>
                    </Box>
                  </Box>
                </div>

                <StoreSwitcher host={host} currentShop={shop} />
                <Box paddingBlockStart="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Keep `shop` and `host` aligned to avoid auth/session mismatch in embedded mode.
                  </Text>
                </Box>
              </div>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function EmbeddedShell() {
  return <Content />;
}
