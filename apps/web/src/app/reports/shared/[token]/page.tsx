'use client';

import { Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StatePanel } from '../../../../components/common/StatePanel';
import { apiFetch } from '../../../../lib/api/fetcher';

type SharedReport = {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  summaryJson: Record<string, unknown>;
};

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.token) {
      return;
    }
    void (async () => {
      try {
        const response = await apiFetch(`/v1/reports/shared/${encodeURIComponent(params.token)}`);
        if (!response.ok) {
          throw new Error(`Shared report fetch failed (${response.status})`);
        }
        setReport((await response.json()) as SharedReport);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [params.token]);

  return (
    <Page title="Shared report">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {error ? (
                <StatePanel kind="error" message={error} />
              ) : !report ? (
                <StatePanel kind="loading" message="Loading shared report" />
              ) : (
                <div className="lw-page-stack">
                  <Text as="h2" variant="headingMd">
                    {report.period} report
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Range: {new Date(report.periodStart).toLocaleDateString()} -{' '}
                    {new Date(report.periodEnd).toLocaleDateString()}
                  </Text>
                  <div className="lw-summary-grid">
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Total spend</div>
                      <div className="lw-metric-value">
                        {String(report.summaryJson.totalSpend ?? 'n/a')}
                      </div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Delta</div>
                      <div className="lw-metric-value">
                        {String(report.summaryJson.deltaVsPrev ?? 'n/a')}
                      </div>
                    </div>
                  </div>
                  <div className="lw-actions-row">
                    <Button
                      onClick={async () => {
                        const response = await apiFetch(
                          `/v1/reports/shared/${encodeURIComponent(params.token)}/export?format=csv`,
                        );
                        if (!response.ok) {
                          setError(`Shared export failed (${response.status})`);
                          return;
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
                      }}
                    >
                      Download CSV
                    </Button>
                    <Button
                      onClick={async () => {
                        const response = await apiFetch(
                          `/v1/reports/shared/${encodeURIComponent(params.token)}/export?format=pdf`,
                        );
                        if (!response.ok) {
                          setError(`Shared export failed (${response.status})`);
                          return;
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
                      }}
                    >
                      Download PDF
                    </Button>
                  </div>
                </div>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
