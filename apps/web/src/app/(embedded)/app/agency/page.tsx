'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

function AgencyPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [summary, setSummary] = useState<{
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
  } | null>(null);

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
      setSummary((await response.json()) as typeof summary);
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
                <>
                  <Text as="p" variant="bodyMd">
                    Shops: {summary.shopsCount} / Total spend: {summary.totalSpend} / Potential
                    savings: {summary.potentialSavings}
                  </Text>
                  <Box paddingBlockStart="300">
                    {summary.topFindingsAcrossShops.map((finding) => (
                      <Text key={finding.id} as="p" variant="bodySm">
                        [{finding.shopId}] {finding.title} ({finding.estimatedSavingsAmount}{' '}
                        {finding.currency})
                      </Text>
                    ))}
                  </Box>
                </>
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
