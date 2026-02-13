'use client';

import { Redirect } from '@shopify/app-bridge/actions';
import createApp from '@shopify/app-bridge';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { apiFetch, getApiBaseUrl } from '../lib/api/fetcher';
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
    const next = new URL(path, window.location.origin);
    if (shop) {
      next.searchParams.set('shop', shop);
    }
    if (host) {
      next.searchParams.set('host', host);
    }
    window.location.assign(next.toString());
  };

  useEffect(() => {
    if (!host) {
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
          return;
        }
        const json = (await response.json()) as Summary;
        setSummary(json);
      } catch {
        setSummary(null);
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
                <div className="lw-shell lw-hero">
                  <span className="lw-eyebrow">Command Center</span>
                  <div className="lw-title">
                    <Text as="h2" variant="headingLg">
                      Shopify Auth + LeakWatch Ops
                    </Text>
                  </div>
                  <div className="lw-subtitle">
                    <Text as="p" variant="bodyMd">
                      Every store signal in one place: connect, verify session token, upload
                      evidence, and chase savings.
                    </Text>
                  </div>
                  <Box paddingBlockStart="200">
                    <span className="lw-inline-chip lw-inline-chip--strong">
                      shop: {shop ?? 'missing'}
                    </span>{' '}
                    <span className="lw-inline-chip">host: {host ?? 'missing'}</span>{' '}
                    <span className="lw-inline-chip">API call: {apiStatus}</span>
                  </Box>
                  <Box paddingBlockStart="300">
                    <div className="lw-actions-row">
                      <Button variant="primary" onClick={onAuthenticate} disabled={!shop}>
                        Authenticate store
                      </Button>
                      <Button onClick={onCallApi} disabled={!host}>
                        Verify session token
                      </Button>
                    </div>
                  </Box>
                </div>

                {summary && (
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
                            <div key={item.label} className="lw-metric">
                              <div className="lw-metric-label">{item.label}</div>
                              <div className="lw-metric-value">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </Box>
                      <Box paddingBlockStart="200">
                        <div className="lw-list">
                          {summary.topFindings.map((finding) => (
                            <div key={finding.id} className="lw-list-item">
                              <Badge tone="attention">Top finding</Badge>{' '}
                              <Text as="span" variant="bodySm">
                                {finding.title} ({finding.estimatedSavingsAmount}{' '}
                                {finding.currency})
                              </Text>
                            </div>
                          ))}
                        </div>
                      </Box>
                    </Box>
                  </div>
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
                          <button
                            key={action.path}
                            type="button"
                            className="lw-action-tile"
                            onClick={() => goTo(action.path)}
                          >
                            <span className="lw-action-title">{action.label}</span>
                            <span className="lw-action-hint">{action.hint}</span>
                          </button>
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
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

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
          <Content />
        </AppBridgeProvider>
      ) : (
        <Content />
      )}
    </AppProvider>
  );
}
