'use client';

import { Redirect } from '@shopify/app-bridge/actions';
import createApp from '@shopify/app-bridge';
import { Badge, Box, Page, Text } from '@shopify/polaris';
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
          label: 'Monthly Spend',
          value: `${summary.currency} ${summary.thisMonthSpend}`,
          hint: 'Last 30 days',
        },
        {
          label: 'Potential Savings',
          value: `${summary.currency} ${summary.potentialSavings}`,
          hint: 'Estimated',
        },
        {
          label: 'Open Actions',
          value: `${summary.openActions}`,
          hint: 'Requires attention',
        },
      ]
    : [];

  const quickActions = [
    {
      label: 'Upload Evidence',
      path: '/app/uploads',
      hint: 'Process invoices and receipts',
    },
    {
      label: 'View Leaks',
      path: '/app/leaks',
      hint: 'Review savings opportunities',
    },
    {
      label: 'Generate Reports',
      path: '/app/reports',
      hint: 'Download weekly summaries',
    },
    {
      label: 'Vendor Actions',
      path: '/app/actions',
      hint: 'Manage outreach queue',
    },
    {
      label: 'Agency Overview',
      path: '/app/agency',
      hint: 'Switch between stores',
    },
    {
      label: 'Billing Settings',
      path: '/app/settings/billing',
      hint: 'Manage your subscription',
    },
  ];

  return (
    <Page
      fullWidth
      title="Command Center"
      subtitle="Monitor and optimize your subscription leak exposure."
    >
      <div className="lw-grid lw-dashboard-root lw-animate-in">
        <div className="lw-dashboard-top">
          <div className="lw-shell">
            <StatusWidget
              shop={shop}
              host={host}
              apiStatus={apiStatus}
              onAuthenticate={onAuthenticate}
              onCallApi={onCallApi}
            />
          </div>
          <StoreSwitcher host={host} currentShop={shop} />
        </div>

        {summaryError ? (
          <StatePanel
            kind="error"
            title="Dashboard error"
            message={summaryError}
            actionLabel="Retry"
            onAction={() => {
              void onCallApi();
            }}
          />
        ) : null}

        {summary ? (
          <div className="lw-grid lw-cols-3">
            {snapshot.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>
        ) : summaryError ? null : (
          <div className="lw-card">
            <Text as="p" tone="subdued" alignment="center">
              Loading dashboard metrics...
            </Text>
          </div>
        )}

        <div className="lw-dashboard-main">
          <section>
            <p className="lw-section-title">Quick Access</p>
            <div className="lw-grid lw-cols-2">
              {quickActions.map((action) => (
                <ActionTile
                  key={action.path}
                  label={action.label}
                  hint={action.hint}
                  onClick={() => goTo(action.path)}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="lw-section-title">Priority Findings</p>
            <div className="lw-card lw-findings-card">
              {summary?.topFindings.length ? (
                <div className="lw-findings-list">
                  {summary.topFindings.map((finding) => (
                    <div key={finding.id} className="lw-finding-row">
                      <div className="lw-finding-copy">
                        <Text as="p" variant="bodyMd">
                          {finding.title}
                        </Text>
                        <Text as="span" tone="subdued" variant="bodySm">
                          Detected recently
                        </Text>
                      </div>
                      <Badge tone="critical">{`${finding.currency} ${finding.estimatedSavingsAmount}`}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <Box padding="400">
                  <Text as="p" tone="subdued" alignment="center">
                    No critical leaks detected.
                  </Text>
                </Box>
              )}
            </div>
          </section>
        </div>

        <Text as="p" variant="bodySm" tone="subdued">
          Keep `shop` and `host` aligned to avoid auth/session mismatch in embedded mode.
        </Text>
      </div>
    </Page>
  );
}

export function EmbeddedShell() {
  return <Content />;
}
