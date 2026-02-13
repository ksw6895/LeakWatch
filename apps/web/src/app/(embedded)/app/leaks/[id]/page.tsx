'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';

type EvidenceRef = {
  id: string;
  kind: string;
  excerpt: string;
  pointerJson: Record<string, unknown>;
};

type FindingDetail = {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string;
  confidence: number;
  estimatedSavingsAmount: string;
  currency: string;
  evidence: EvidenceRef[];
};

function LeaksDetailContent() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    if (!host || !params.id) {
      return;
    }

    void (async () => {
      try {
        const response = await apiFetch(`/v1/findings/${params.id}`, { host });
        if (!response.ok) {
          throw new Error(`Finding fetch failed (${response.status})`);
        }
        const json = (await response.json()) as FindingDetail;
        setFinding(json);
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

  const dismiss = async () => {
    if (!host || !finding) {
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/findings/${finding.id}/dismiss`, {
        host,
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Dismiss failed (${response.status})`);
      }
      const json = (await response.json()) as FindingDetail;
      setFinding(json);
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const createActionDraft = async () => {
    if (!host || !finding) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch(`/v1/findings/${finding.id}/actions`, {
        host,
        method: 'POST',
        body: JSON.stringify({
          type: 'CLARIFICATION',
          toEmail: 'finance@example.com',
        }),
      });
      if (!response.ok) {
        throw new Error(`Create action draft failed (${response.status})`);
      }
      const json = (await response.json()) as { id: string };
      const target = new URL(`/app/actions/${json.id}`, window.location.origin);
      if (host) {
        target.searchParams.set('host', host);
      }
      if (shop) {
        target.searchParams.set('shop', shop);
      }
      window.location.assign(target.toString());
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      setBusy(false);
    }
  };

  return (
    <AppProvider i18n={enTranslations}>
      {appBridgeConfig ? (
        <AppBridgeProvider config={appBridgeConfig}>
          <Page title="Leak Detail">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="400">
                    {error ? (
                      <Text as="p" variant="bodyMd" tone="critical">
                        {error}
                      </Text>
                    ) : !finding ? (
                      <Text as="p" variant="bodyMd">
                        Loading...
                      </Text>
                    ) : (
                      <>
                        <Text as="h2" variant="headingMd">
                          {finding.title}
                        </Text>
                        <Box paddingBlockStart="200">
                          <Badge>{finding.type}</Badge>
                          <Box paddingBlockStart="100">
                            <Text as="p" variant="bodySm" tone="subdued">
                              Status: {finding.status} / Confidence: {finding.confidence}
                            </Text>
                          </Box>
                        </Box>
                        <Box paddingBlockStart="300">
                          <Text as="p" variant="bodyMd">
                            {finding.summary}
                          </Text>
                          <Text as="p" variant="bodyMd">
                            Savings estimate: {finding.estimatedSavingsAmount} {finding.currency}
                          </Text>
                        </Box>
                        <Box paddingBlockStart="300">
                          <Button
                            variant="primary"
                            disabled={busy || finding.status === 'DISMISSED'}
                            onClick={dismiss}
                          >
                            Dismiss finding
                          </Button>
                          <Box paddingBlockStart="200">
                            <Button onClick={createActionDraft} disabled={busy}>
                              Create action draft
                            </Button>
                          </Box>
                          <Box paddingBlockStart="200">
                            <Button
                              onClick={() => {
                                const target = new URL('/app/leaks', window.location.origin);
                                if (host) {
                                  target.searchParams.set('host', host);
                                }
                                if (shop) {
                                  target.searchParams.set('shop', shop);
                                }
                                window.location.assign(target.toString());
                              }}
                            >
                              Back to list
                            </Button>
                          </Box>
                        </Box>
                        <Box paddingBlockStart="400">
                          <Text as="h3" variant="headingSm">
                            Evidence
                          </Text>
                          <Box paddingBlockStart="200">
                            {finding.evidence.length === 0 ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                No evidence attached
                              </Text>
                            ) : (
                              finding.evidence.map((evidence) => (
                                <Box key={evidence.id} paddingBlockEnd="300">
                                  <Text as="p" variant="bodySm">
                                    {evidence.kind}
                                  </Text>
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    {evidence.excerpt}
                                  </Text>
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    {JSON.stringify(evidence.pointerJson)}
                                  </Text>
                                </Box>
                              ))
                            )}
                          </Box>
                        </Box>
                      </>
                    )}
                  </Box>
                </Card>
              </Layout.Section>
            </Layout>
          </Page>
        </AppBridgeProvider>
      ) : (
        <Page title="Leak Detail" />
      )}
    </AppProvider>
  );
}

export default function LeakDetailPage() {
  return (
    <Suspense>
      <LeaksDetailContent />
    </Suspense>
  );
}
