'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';

function formatUtcDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function ReportDetailPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [report, setReport] = useState<{
    id: string;
    period: string;
    periodStart: string;
    periodEnd: string;
    summaryJson: Record<string, unknown>;
    createdAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !params.id) {
      return;
    }
    void (async () => {
      try {
        const response = await apiFetch(`/v1/reports/${params.id}`, { host });
        if (!response.ok) {
          throw new Error(`Report fetch failed (${response.status})`);
        }
        setReport((await response.json()) as typeof report);
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host, params.id]);

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const content = (
    <Page title="Report detail">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {error ? (
                <Text as="p" variant="bodyMd" tone="critical">
                  {error}
                </Text>
              ) : !report ? (
                <Text as="p" variant="bodyMd">
                  Loading...
                </Text>
              ) : (
                <>
                  <Text as="p" variant="bodyMd">
                    {report.period} / {formatUtcDate(report.periodStart)} -{' '}
                    {formatUtcDate(report.periodEnd)}
                  </Text>
                  <Box paddingBlockStart="300">
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(report.summaryJson, null, 2)}
                    </pre>
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

export default function ReportDetailPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <ReportDetailPageContent />
      </AppProvider>
    </Suspense>
  );
}
