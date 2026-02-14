'use client';

import { Badge, Box, Button, Card, Layout, Page, Text } from '@shopify/polaris';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { StatePanel } from '../../../../../components/common/StatePanel';
import { apiFetch } from '../../../../../lib/api/fetcher';
import { navigateEmbedded } from '../../../../../lib/navigation/embedded';

type LineItem = {
  id: string;
  description: string | null;
  amount: string;
  currency: string;
  itemType: string;
  recurringCadence: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

type NormalizedInvoice = {
  id: string;
  currency: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  totalAmount: string;
  rawJson: Record<string, unknown>;
  lineItems: LineItem[];
};

type DocumentVersion = {
  id: string;
  version: number;
  fileName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  normalized: NormalizedInvoice | null;
};

type DocumentDetail = {
  id: string;
  vendorHint: string | null;
  createdAt: string;
  versions: DocumentVersion[];
};

type StageState = 'done' | 'current' | 'failed' | 'pending';

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }
  return new Date(value).toLocaleString();
}

function formatBytes(byteSize: number): string {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return '0 B';
  }

  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  const kb = byteSize / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function inferStageStates(status: string): {
  upload: StageState;
  extraction: StageState;
  normalization: StageState;
  detection: StageState;
  ready: StageState;
} {
  if (status === 'CREATED') {
    return {
      upload: 'current',
      extraction: 'pending',
      normalization: 'pending',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'UPLOADED') {
    return {
      upload: 'done',
      extraction: 'current',
      normalization: 'pending',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'EXTRACTION_RUNNING') {
    return {
      upload: 'done',
      extraction: 'current',
      normalization: 'pending',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'EXTRACTION_FAILED') {
    return {
      upload: 'done',
      extraction: 'failed',
      normalization: 'pending',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'EXTRACTED') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'current',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'NORMALIZATION_RUNNING') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'current',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'NORMALIZATION_FAILED') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'failed',
      detection: 'pending',
      ready: 'pending',
    };
  }
  if (status === 'NORMALIZED') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'done',
      detection: 'current',
      ready: 'pending',
    };
  }
  if (status === 'DETECTION_RUNNING') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'done',
      detection: 'current',
      ready: 'pending',
    };
  }
  if (status === 'DETECTION_FAILED') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'done',
      detection: 'failed',
      ready: 'pending',
    };
  }
  if (status === 'DETECTED') {
    return {
      upload: 'done',
      extraction: 'done',
      normalization: 'done',
      detection: 'done',
      ready: 'current',
    };
  }

  return {
    upload: 'done',
    extraction: 'done',
    normalization: 'done',
    detection: 'done',
    ready: 'done',
  };
}

function badgeTone(state: StageState): 'info' | 'success' | 'attention' | 'critical' {
  if (state === 'done') {
    return 'success';
  }
  if (state === 'current') {
    return 'attention';
  }
  if (state === 'failed') {
    return 'critical';
  }
  return 'info';
}

function resolveReturnPath(rawPath: string | null): string {
  if (!rawPath) {
    return '/app/uploads';
  }

  if (!rawPath.startsWith('/app') || rawPath.startsWith('//')) {
    return '/app/uploads';
  }

  return rawPath;
}

function DocumentDetailPageContent() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const requestedVersionId = searchParams.get('versionId');
  const returnPath = resolveReturnPath(searchParams.get('from'));

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);
  const [downloadingVersionId, setDownloadingVersionId] = useState<string | null>(null);

  useEffect(() => {
    if (!host || !params.documentId) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const response = await apiFetch(`/v1/documents/${params.documentId}`, { host });
        if (!response.ok) {
          throw new Error(`Document fetch failed (${response.status})`);
        }
        const json = (await response.json()) as DocumentDetail;
        setDocument(json);
        const requestedExists = requestedVersionId
          ? json.versions.some((version) => version.id === requestedVersionId)
          : false;
        setSelectedVersionId(requestedExists ? requestedVersionId : (json.versions[0]?.id ?? null));
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [host, params.documentId, requestedVersionId]);

  const selectedVersion = useMemo(() => {
    if (!document || document.versions.length === 0) {
      return null;
    }
    return (
      document.versions.find((version) => version.id === selectedVersionId) ?? document.versions[0]
    );
  }, [document, selectedVersionId]);

  const failedVersionsCount = useMemo(
    () => document?.versions.filter((version) => version.status.endsWith('FAILED')).length ?? 0,
    [document],
  );

  const normalizedCount = useMemo(
    () => document?.versions.filter((version) => version.normalized !== null).length ?? 0,
    [document],
  );

  const downloadVersion = async (versionId: string) => {
    if (!host || !document) {
      return;
    }

    setDownloadingVersionId(versionId);
    try {
      const response = await apiFetch(
        `/v1/documents/${document.id}/versions/${versionId}/download`,
        {
          host,
        },
      );
      if (!response.ok) {
        throw new Error(`Download URL fetch failed (${response.status})`);
      }
      const payload = (await response.json()) as { downloadUrl: string };
      window.location.assign(payload.downloadUrl);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setDownloadingVersionId(null);
    }
  };

  return (
    <Page title="Document Detail">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {!host ? (
                <StatePanel
                  kind="error"
                  title="Missing host context"
                  message="Re-open LeakWatch from Shopify Admin to restore embedded session parameters."
                />
              ) : loading ? (
                <StatePanel
                  kind="loading"
                  message="Loading document versions and processing history."
                />
              ) : error ? (
                <StatePanel kind="error" message={error} />
              ) : !document ? (
                <StatePanel kind="empty" message="Document not found." />
              ) : (
                <div className="lw-page-stack lw-animate-in">
                  <div className="lw-hero">
                    <span className="lw-eyebrow">Document Intelligence</span>
                    <div className="lw-title">
                      <Text as="h2" variant="headingMd">
                        {selectedVersion?.fileName ?? `Document ${document.id}`}
                      </Text>
                    </div>
                    <Box paddingBlockStart="200">
                      <span className="lw-inline-chip">document: {document.id}</span>{' '}
                      {document.vendorHint ? (
                        <span className="lw-inline-chip">vendor hint: {document.vendorHint}</span>
                      ) : null}{' '}
                      <span className="lw-inline-chip">
                        created: {formatDateTime(document.createdAt)}
                      </span>
                    </Box>
                  </div>

                  <div className="lw-summary-grid">
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Versions</div>
                      <div className="lw-metric-value">{document.versions.length}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Latest status</div>
                      <div className="lw-metric-value">{document.versions[0]?.status ?? 'n/a'}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Normalized versions</div>
                      <div className="lw-metric-value">{normalizedCount}</div>
                    </div>
                    <div className="lw-metric lw-metric--compact">
                      <div className="lw-metric-label">Failed versions</div>
                      <div className="lw-metric-value">{failedVersionsCount}</div>
                    </div>
                  </div>

                  <div className="lw-content-box">
                    <div className="lw-title">
                      <Text as="h3" variant="headingSm">
                        Version history
                      </Text>
                    </div>
                    {document.versions.length === 0 ? (
                      <Box paddingBlockStart="200">
                        <StatePanel kind="empty" message="No versions found for this document." />
                      </Box>
                    ) : (
                      <Box paddingBlockStart="200">
                        <div className="lw-table-wrap">
                          <Text as="p" variant="bodySm" tone="subdued">
                            Swipe horizontally on smaller screens to inspect full version columns.
                          </Text>
                          <table className="lw-table">
                            <thead>
                              <tr>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Size</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {document.versions.map((version) => (
                                <tr key={version.id}>
                                  <td>
                                    <Text as="p" variant="bodySm">
                                      v{version.version} - {version.fileName}
                                    </Text>
                                    <div className="lw-metric-hint">{version.mimeType}</div>
                                  </td>
                                  <td>
                                    <Badge
                                      tone={version.status.endsWith('FAILED') ? 'critical' : 'info'}
                                    >
                                      {version.status}
                                    </Badge>
                                  </td>
                                  <td>{formatDateTime(version.createdAt)}</td>
                                  <td>{formatBytes(version.byteSize)}</td>
                                  <td>
                                    <div className="lw-actions-row">
                                      <Button
                                        variant={
                                          selectedVersion?.id === version.id
                                            ? 'primary'
                                            : 'tertiary'
                                        }
                                        onClick={() => {
                                          setSelectedVersionId(version.id);
                                          setShowRawJson(false);
                                          setShowLineItems(false);
                                        }}
                                      >
                                        View detail
                                      </Button>
                                      <Button
                                        loading={downloadingVersionId === version.id}
                                        onClick={() => {
                                          void downloadVersion(version.id);
                                        }}
                                      >
                                        Download
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Box>
                    )}
                  </div>

                  {selectedVersion ? (
                    <>
                      <div className="lw-content-box">
                        <div className="lw-title">
                          <Text as="h3" variant="headingSm">
                            Processing timeline (v{selectedVersion.version})
                          </Text>
                        </div>
                        <Box paddingBlockStart="200">
                          {(() => {
                            const stages = inferStageStates(selectedVersion.status);
                            return (
                              <div className="lw-list">
                                <div className="lw-list-item">
                                  <Text as="p" variant="bodySm">
                                    Upload accepted
                                  </Text>
                                  <Badge tone={badgeTone(stages.upload)}>{stages.upload}</Badge>
                                </div>
                                <div className="lw-list-item">
                                  <Text as="p" variant="bodySm">
                                    Text extraction
                                  </Text>
                                  <Badge tone={badgeTone(stages.extraction)}>
                                    {stages.extraction}
                                  </Badge>
                                </div>
                                <div className="lw-list-item">
                                  <Text as="p" variant="bodySm">
                                    Invoice normalization
                                  </Text>
                                  <Badge tone={badgeTone(stages.normalization)}>
                                    {stages.normalization}
                                  </Badge>
                                </div>
                                <div className="lw-list-item">
                                  <Text as="p" variant="bodySm">
                                    Leak detection
                                  </Text>
                                  <Badge tone={badgeTone(stages.detection)}>
                                    {stages.detection}
                                  </Badge>
                                </div>
                                <div className="lw-list-item">
                                  <Text as="p" variant="bodySm">
                                    Ready for downstream flow
                                  </Text>
                                  <Badge tone={badgeTone(stages.ready)}>{stages.ready}</Badge>
                                </div>
                              </div>
                            );
                          })()}
                        </Box>
                        {selectedVersion.errorCode || selectedVersion.errorMessage ? (
                          <Box paddingBlockStart="200">
                            <Text as="p" variant="bodySm" tone="critical">
                              {selectedVersion.errorCode ?? 'PROCESSING_FAILED'}
                            </Text>
                            {selectedVersion.errorMessage ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {selectedVersion.errorMessage}
                              </Text>
                            ) : null}
                          </Box>
                        ) : null}
                      </div>

                      <div className="lw-content-box">
                        <div className="lw-title">
                          <Text as="h3" variant="headingSm">
                            Normalized invoice snapshot
                          </Text>
                        </div>
                        {!selectedVersion.normalized ? (
                          <Box paddingBlockStart="200">
                            <StatePanel
                              kind="empty"
                              message="Normalized invoice payload is not available for this version yet."
                            />
                          </Box>
                        ) : (
                          <Box paddingBlockStart="200">
                            <div className="lw-summary-grid">
                              <div className="lw-metric lw-metric--compact">
                                <div className="lw-metric-label">Invoice number</div>
                                <div className="lw-metric-value">
                                  {selectedVersion.normalized.invoiceNumber ?? 'n/a'}
                                </div>
                              </div>
                              <div className="lw-metric lw-metric--compact">
                                <div className="lw-metric-label">Invoice date</div>
                                <div className="lw-metric-value">
                                  {formatDateTime(selectedVersion.normalized.invoiceDate)}
                                </div>
                              </div>
                              <div className="lw-metric lw-metric--compact">
                                <div className="lw-metric-label">Billing period</div>
                                <div className="lw-metric-value">
                                  {formatDateTime(selectedVersion.normalized.billingPeriodStart)} -{' '}
                                  {formatDateTime(selectedVersion.normalized.billingPeriodEnd)}
                                </div>
                              </div>
                              <div className="lw-metric lw-metric--compact">
                                <div className="lw-metric-label">Total amount</div>
                                <div className="lw-metric-value">
                                  {selectedVersion.normalized.totalAmount}{' '}
                                  {selectedVersion.normalized.currency}
                                </div>
                              </div>
                            </div>

                            <Box paddingBlockStart="200">
                              {selectedVersion.normalized.lineItems.length === 0 ? (
                                <Text as="p" variant="bodySm" tone="subdued">
                                  No normalized line items.
                                </Text>
                              ) : (
                                <>
                                  <div className="lw-actions-row">
                                    <Button
                                      onClick={() => {
                                        setShowLineItems((prev) => !prev);
                                      }}
                                    >
                                      {showLineItems ? 'Hide line items' : 'Show line items'}
                                    </Button>
                                  </div>
                                  {showLineItems ? (
                                    <Box paddingBlockStart="200">
                                      <div className="lw-table-wrap">
                                        <Text as="p" variant="bodySm" tone="subdued">
                                          Swipe horizontally on smaller screens to inspect full
                                          line-item columns.
                                        </Text>
                                        <table className="lw-table">
                                          <thead>
                                            <tr>
                                              <th>Type</th>
                                              <th>Description</th>
                                              <th>Amount</th>
                                              <th>Period</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {selectedVersion.normalized.lineItems.map(
                                              (lineItem) => (
                                                <tr key={lineItem.id}>
                                                  <td>{lineItem.itemType}</td>
                                                  <td>
                                                    {lineItem.description ?? 'n/a'}
                                                    {lineItem.recurringCadence ? (
                                                      <div className="lw-metric-hint">
                                                        cadence: {lineItem.recurringCadence}
                                                      </div>
                                                    ) : null}
                                                  </td>
                                                  <td>
                                                    {lineItem.amount} {lineItem.currency}
                                                  </td>
                                                  <td>
                                                    {formatDateTime(lineItem.periodStart)} -{' '}
                                                    {formatDateTime(lineItem.periodEnd)}
                                                  </td>
                                                </tr>
                                              ),
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </Box>
                                  ) : null}
                                </>
                              )}
                            </Box>

                            <Box paddingBlockStart="200">
                              <div className="lw-actions-row">
                                <Button
                                  onClick={() => {
                                    setShowRawJson((prev) => !prev);
                                  }}
                                >
                                  {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
                                </Button>
                              </div>
                            </Box>
                            {showRawJson ? (
                              <Box paddingBlockStart="200">
                                <pre className="lw-pre">
                                  {JSON.stringify(selectedVersion.normalized.rawJson, null, 2)}
                                </pre>
                              </Box>
                            ) : null}
                          </Box>
                        )}
                      </div>
                    </>
                  ) : null}

                  <div className="lw-actions-row">
                    <Button
                      onClick={() => {
                        navigateEmbedded(returnPath, { host, shop });
                      }}
                    >
                      Back
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

export default function DocumentDetailPage() {
  return (
    <Suspense>
      <DocumentDetailPageContent />
    </Suspense>
  );
}
