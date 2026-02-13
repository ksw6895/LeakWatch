'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';
import { StatePanel } from '../../../../../components/common/StatePanel';
import {
  billingAccessReason,
  canManageBilling,
  writeAccessReason,
} from '../../../../../lib/auth/roles';

type BillingCurrent = {
  plan: string;
  planStatus: string;
  limits: {
    uploads: number;
    emails: number;
    findings: number;
  };
  usage: {
    uploads: number;
    emails: number;
  };
};

type AuthMe = {
  shopId: string;
  roles: string[];
};

function BillingPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [current, setCurrent] = useState<BillingCurrent | null>(null);
  const [upgradingPlan, setUpgradingPlan] = useState<'STARTER' | 'PRO' | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const billingAllowed = canManageBilling(roles);
  const blockedReason = billingAccessReason(roles) || writeAccessReason(roles);

  const refresh = useCallback(async () => {
    if (!host) {
      return;
    }
    const meResponse = await apiFetch('/v1/auth/me', { host });
    if (!meResponse.ok) {
      return;
    }
    const me = (await meResponse.json()) as AuthMe;
    setRoles(me.roles ?? []);
    const response = await apiFetch(`/v1/billing/current?shopId=${encodeURIComponent(me.shopId)}`, {
      host,
    });
    if (!response.ok) {
      return;
    }
    setCurrent((await response.json()) as BillingCurrent);
  }, [host]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadsUsagePercent = useMemo(() => {
    if (!current || current.limits.uploads === 0) {
      return 0;
    }
    return Math.min(100, Math.round((current.usage.uploads / current.limits.uploads) * 100));
  }, [current]);
  const emailsUsagePercent = useMemo(() => {
    if (!current || current.limits.emails === 0) {
      return 0;
    }
    return Math.min(100, Math.round((current.usage.emails / current.limits.emails) * 100));
  }, [current]);

  const upgradeTo = async (plan: 'STARTER' | 'PRO') => {
    if (!host || !billingAllowed) {
      return;
    }
    setUpgradingPlan(plan);
    try {
      const response = await apiFetch(`/v1/billing/subscribe?plan=${plan}`, {
        host,
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setError(`Upgrade failed (${response.status})`);
        return;
      }
      const json = (await response.json()) as { confirmationUrl?: string };
      if (json.confirmationUrl) {
        window.location.assign(json.confirmationUrl);
        return;
      }
      await refresh();
      setError(null);
    } finally {
      setUpgradingPlan(null);
    }
  };

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const content = (
    <Page title="Billing">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {!current ? (
                <StatePanel kind="loading" message="Loading billing quota and plan information." />
              ) : (
                <div className="lw-page-stack lw-animate-in">
                  <div className="lw-hero">
                    <span className="lw-eyebrow">Billing Control</span>
                    <div className="lw-title">
                      <Text as="h2" variant="headingMd">
                        Plan and usage overview
                      </Text>
                    </div>
                    <div className="lw-subtitle">
                      <Text as="p" variant="bodySm">
                        Monitor utilization and move plans before caps block operations.
                      </Text>
                    </div>
                  </div>

                  <div className="lw-summary-grid">
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Current plan</div>
                      <div className="lw-metric-value">{current.plan}</div>
                      <div className="lw-metric-hint">status: {current.planStatus}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Uploads usage</div>
                      <div className="lw-metric-value">
                        {current.usage.uploads}/{current.limits.uploads}
                      </div>
                      <div className="lw-metric-hint">{uploadsUsagePercent}% of quota</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Email usage</div>
                      <div className="lw-metric-value">
                        {current.usage.emails}/{current.limits.emails}
                      </div>
                      <div className="lw-metric-hint">{emailsUsagePercent}% of quota</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Findings cap</div>
                      <div className="lw-metric-value">{current.limits.findings}</div>
                    </div>
                  </div>

                  <div className="lw-content-box">
                    {error ? (
                      <Box paddingBlockEnd="200">
                        <StatePanel kind="error" message={error} />
                      </Box>
                    ) : null}
                    <Text as="p" variant="bodySm" tone="subdued">
                      Upgrades apply immediately and refresh current quota limits.
                    </Text>
                    <Box paddingBlockStart="300">
                      <div className="lw-actions-row">
                        <Button
                          variant="primary"
                          loading={upgradingPlan === 'STARTER'}
                          disabled={!billingAllowed}
                          onClick={() => {
                            void upgradeTo('STARTER');
                          }}
                        >
                          Upgrade to STARTER
                        </Button>
                        <Button
                          loading={upgradingPlan === 'PRO'}
                          disabled={!billingAllowed}
                          onClick={() => {
                            void upgradeTo('PRO');
                          }}
                        >
                          Upgrade to PRO
                        </Button>
                      </div>
                      {!billingAllowed ? (
                        <Box paddingBlockStart="200">
                          <Text as="p" variant="bodySm" tone="subdued">
                            {blockedReason}
                          </Text>
                        </Box>
                      ) : null}
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

  return appBridgeConfig ? (
    <AppBridgeProvider config={appBridgeConfig}>{content}</AppBridgeProvider>
  ) : (
    content
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <BillingPageContent />
      </AppProvider>
    </Suspense>
  );
}
