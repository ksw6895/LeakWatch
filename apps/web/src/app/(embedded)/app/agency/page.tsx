'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

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
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [summary, setSummary] = useState<AgencySummary | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }
    void (async () => {
      const meResponse = await apiFetch('/v1/auth/me', { host });
      if (!meResponse.ok) {
        return;
      }
      const me = (await meResponse.json()) as { orgId: string };
      const response = await apiFetch(`/v1/orgs/${me.orgId}/summary`, { host });
      if (!response.ok) {
        return;
      }
      setSummary((await response.json()) as AgencySummary);
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

  const content = (
    <Page title="Agency dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {!summary ? (
                <Text as="p" variant="bodyMd">
                  Loading...
                </Text>
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
                      <div className="lw-list">
                        {summary.topFindingsAcrossShops.map((finding) => (
                          <div key={finding.id} className="lw-list-item">
                            <Text as="p" variant="bodySm">
                              [{finding.shopId}] {finding.title}
                            </Text>
                            <div className="lw-metric-hint">
                              {finding.estimatedSavingsAmount} {finding.currency}
                            </div>
                          </div>
                        ))}
                      </div>
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

export default function AgencyPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <AgencyPageContent />
      </AppProvider>
    </Suspense>
  );
}
