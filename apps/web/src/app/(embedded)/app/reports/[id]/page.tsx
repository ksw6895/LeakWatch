'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';
import { StatePanel } from '../../../../../components/common/StatePanel';
import { navigateEmbedded } from '../../../../../lib/navigation/embedded';

type ReportDetail = {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  summaryJson: Record<string, unknown>;
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

function ReportDetailPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

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
        setReport((await response.json()) as ReportDetail);
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
                <StatePanel kind="error" message={error} />
              ) : !report ? (
                <StatePanel kind="loading" message="Loading report detail and generated summary." />
              ) : (
                <div className="lw-page-stack lw-animate-in">
                  <div className="lw-hero">
                    <span className="lw-eyebrow">Report Detail</span>
                    <div className="lw-title">
                      <Text as="h2" variant="headingMd">
                        {report.period} report
                      </Text>
                    </div>
                    <Box paddingBlockStart="200">
                      <span className="lw-inline-chip">
                        range: {formatUtcDate(report.periodStart)} -{' '}
                        {formatUtcDate(report.periodEnd)}
                      </span>{' '}
                      <span className="lw-inline-chip">
                        generated: {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </Box>
                  </div>

                  <div className="lw-content-box">
                    <div className="lw-summary-grid">
                      <div className="lw-metric lw-metric--compact">
                        <div className="lw-metric-label">Total spend</div>
                        <div className="lw-metric-value">
                          {String(report.summaryJson.totalSpend ?? 'n/a')}
                        </div>
                      </div>
                      <div className="lw-metric lw-metric--compact">
                        <div className="lw-metric-label">Previous spend</div>
                        <div className="lw-metric-value">
                          {String(report.summaryJson.prevTotalSpend ?? 'n/a')}
                        </div>
                      </div>
                      <div className="lw-metric lw-metric--compact">
                        <div className="lw-metric-label">Delta vs previous</div>
                        <div className="lw-metric-value">
                          {String(report.summaryJson.deltaVsPrev ?? 'n/a')}
                        </div>
                      </div>
                      <div className="lw-metric lw-metric--compact">
                        <div className="lw-metric-label">Top findings</div>
                        <div className="lw-metric-value">
                          {Array.isArray(report.summaryJson.topFindings)
                            ? report.summaryJson.topFindings.length
                            : 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lw-content-box">
                    <Text as="h3" variant="headingSm">
                      Summary fields
                    </Text>
                    <Box paddingBlockStart="200">
                      <div className="lw-list">
                        {Object.entries(report.summaryJson)
                          .slice(0, 8)
                          .map(([key, value]) => (
                            <div key={key} className="lw-list-item">
                              <Text as="p" variant="bodySm">
                                {key}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {typeof value === 'object' ? 'structured value' : String(value)}
                              </Text>
                            </div>
                          ))}
                      </div>
                    </Box>
                  </div>

                  <div className="lw-content-box">
                    <div className="lw-actions-row">
                      <Button
                        onClick={() => {
                          setShowRaw((prev) => !prev);
                        }}
                      >
                        {showRaw ? 'Hide advanced JSON' : 'Show advanced JSON'}
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!host || !report) {
                            return;
                          }
                          try {
                            const response = await apiFetch(`/v1/reports/${report.id}/share-link`, {
                              host,
                              method: 'POST',
                              body: JSON.stringify({}),
                            });
                            if (!response.ok) {
                              throw new Error(`Share link failed (${response.status})`);
                            }
                            const payload = (await response.json()) as { shareUrl: string };
                            setShareUrl(payload.shareUrl);
                            if (navigator.clipboard?.writeText) {
                              await navigator.clipboard.writeText(payload.shareUrl);
                            }
                          } catch (unknownError) {
                            setError(
                              unknownError instanceof Error
                                ? unknownError.message
                                : 'Share link failed',
                            );
                          }
                        }}
                      >
                        Create share link
                      </Button>
                      <Button
                        disabled={!shareUrl}
                        onClick={async () => {
                          if (!host || !report) {
                            return;
                          }
                          try {
                            const response = await apiFetch(
                              `/v1/reports/${report.id}/share-link/revoke`,
                              {
                                host,
                                method: 'POST',
                                body: JSON.stringify({}),
                              },
                            );
                            if (!response.ok) {
                              throw new Error(`Share revoke failed (${response.status})`);
                            }
                            setShareUrl(null);
                          } catch (unknownError) {
                            setError(
                              unknownError instanceof Error
                                ? unknownError.message
                                : 'Share revoke failed',
                            );
                          }
                        }}
                      >
                        Revoke share link
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!host || !report) {
                            return;
                          }
                          try {
                            const response = await apiFetch(
                              `/v1/reports/${report.id}/export?format=csv`,
                              { host },
                            );
                            if (!response.ok) {
                              throw new Error(`Export failed (${response.status})`);
                            }
                            const payload = (await response.json()) as {
                              fileName: string;
                              contentType: string;
                              content: string;
                            };
                            const blob = new Blob([payload.content], {
                              type: payload.contentType,
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = payload.fileName;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (unknownError) {
                            setError(
                              unknownError instanceof Error
                                ? unknownError.message
                                : 'Export failed',
                            );
                          }
                        }}
                      >
                        Export CSV
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!host || !report) {
                            return;
                          }
                          try {
                            const response = await apiFetch(
                              `/v1/reports/${report.id}/export?format=pdf`,
                              { host },
                            );
                            if (!response.ok) {
                              throw new Error(`Export failed (${response.status})`);
                            }
                            const payload = (await response.json()) as {
                              fileName: string;
                              contentType: string;
                              content: string;
                            };
                            const blob = new Blob([payload.content], {
                              type: payload.contentType,
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = payload.fileName;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (unknownError) {
                            setError(
                              unknownError instanceof Error
                                ? unknownError.message
                                : 'Export failed',
                            );
                          }
                        }}
                      >
                        Export PDF
                      </Button>
                    </div>
                    {shareUrl ? (
                      <Box paddingBlockStart="200">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Share link: {shareUrl}
                        </Text>
                      </Box>
                    ) : null}
                    {showRaw ? (
                      <>
                        <Text as="h3" variant="headingSm">
                          Raw JSON
                        </Text>
                        <Box paddingBlockStart="200">
                          <pre className="lw-pre">
                            {JSON.stringify(report.summaryJson, null, 2)}
                          </pre>
                        </Box>
                      </>
                    ) : null}
                    <Box paddingBlockStart="200">
                      <Button
                        onClick={() => {
                          navigateEmbedded('/app/reports', { host, shop });
                        }}
                      >
                        Back to reports
                      </Button>
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

export default function ReportDetailPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <ReportDetailPageContent />
      </AppProvider>
    </Suspense>
  );
}
