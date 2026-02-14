'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  InlineError,
  Layout,
  Page,
  ProgressBar,
  Text,
  TextField,
} from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch } from '../lib/api/fetcher';
import { canUpload, writeAccessReason } from '../lib/auth/roles';
import { navigateEmbedded } from '../lib/navigation/embedded';
import { StatePanel } from './common/StatePanel';

type AuthMe = {
  orgId: string;
  shopId: string;
  userId: string;
  roles: string[];
  shopDomain: string;
};

type DocumentVersion = {
  id: string;
  version: number;
  fileName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

type DocumentRow = {
  id: string;
  vendorHint: string | null;
  createdAt: string;
  versions: DocumentVersion[];
};

type UploadState = {
  step: 'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error';
  progress: number;
  message?: string;
};

type BillingCurrent = {
  limits: {
    uploads: number;
  };
  usage: {
    uploads: number;
  };
};

function statusTone(status: string): 'info' | 'success' | 'attention' | 'critical' {
  if (status.endsWith('FAILED')) {
    return 'critical';
  }
  if (
    status === 'DONE' ||
    status === 'UPLOADED' ||
    status === 'NORMALIZED' ||
    status === 'DETECTED'
  ) {
    return 'success';
  }
  if (status.endsWith('RUNNING') || status === 'CREATED') {
    return 'attention';
  }
  return 'info';
}

function mapErrorCodeToHint(errorCode: string | null | undefined): string {
  if (!errorCode) {
    return 'Unknown failure. Please retry upload with the latest invoice file.';
  }

  if (errorCode.includes('FILE_TOO_LARGE')) {
    return 'File size exceeded your current limit. Reduce file size or upgrade your plan.';
  }
  if (errorCode.includes('MIME') || errorCode.includes('UNSUPPORTED')) {
    return 'Unsupported file format. Upload PDF, CSV, PNG, or JPG.';
  }
  if (errorCode.includes('NORMALIZATION')) {
    return 'Normalization failed. Add vendor hint and retry with a cleaner source file.';
  }
  if (errorCode.includes('DETECTION')) {
    return 'Detection step failed. Retry upload or check extracted document quality.';
  }

  return 'Processing failed. Retry upload and contact support if this continues.';
}

async function buildApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    if (typeof message === 'string' && message.length > 0) {
      return `${fallback}: ${message}`;
    }
    if (typeof body.error === 'string' && body.error.length > 0) {
      return `${fallback}: ${body.error}`;
    }
  } catch {
    // ignore parse errors and fall back to status-only message
  }
  return fallback;
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function UploadsPanel({ host, shop }: { host: string | null; shop: string | null }) {
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [vendorHint, setVendorHint] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ step: 'idle', progress: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingCurrent | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canStartUpload = useMemo(
    () =>
      Boolean(
        host &&
        auth?.shopId &&
        selectedFile &&
        uploadState.step !== 'uploading' &&
        canUpload(auth?.roles ?? []),
      ),
    [host, auth?.roles, auth?.shopId, selectedFile, uploadState.step],
  );
  const uploadQuotaReached = useMemo(() => {
    if (!billing) {
      return false;
    }
    return billing.usage.uploads >= billing.limits.uploads;
  }, [billing]);
  const uploadBlockedReason = writeAccessReason(auth?.roles ?? []);
  const latestStatuses = useMemo(
    () => documents.map((document) => document.versions?.[0]?.status ?? 'UNKNOWN'),
    [documents],
  );
  const completedCount = useMemo(
    () =>
      latestStatuses.filter(
        (status) =>
          status === 'DONE' ||
          status === 'UPLOADED' ||
          status === 'NORMALIZED' ||
          status === 'DETECTED',
      ).length,
    [latestStatuses],
  );
  const failedCount = useMemo(
    () => latestStatuses.filter((status) => status.endsWith('FAILED')).length,
    [latestStatuses],
  );
  const runningCount = useMemo(
    () =>
      latestStatuses.filter((status) => status.endsWith('RUNNING') || status === 'CREATED').length,
    [latestStatuses],
  );

  const loadAuthAndDocuments = useCallback(async () => {
    if (!host) {
      return;
    }

    setErrorMessage(null);

    const meResponse = await apiFetch('/v1/auth/me', { host });
    if (!meResponse.ok) {
      throw new Error(`Auth check failed (${meResponse.status})`);
    }

    const meJson = (await meResponse.json()) as AuthMe;
    setAuth(meJson);

    const docsResponse = await apiFetch(`/v1/documents?shopId=${meJson.shopId}`, { host });
    if (!docsResponse.ok) {
      throw new Error(`Document list failed (${docsResponse.status})`);
    }

    const docsJson = (await docsResponse.json()) as DocumentRow[];
    setDocuments(docsJson);

    const billingResponse = await apiFetch(`/v1/billing/current?shopId=${meJson.shopId}`, { host });
    if (billingResponse.ok) {
      setBilling((await billingResponse.json()) as BillingCurrent);
    }
  }, [host]);

  useEffect(() => {
    void loadAuthAndDocuments().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
    });
  }, [loadAuthAndDocuments]);

  useEffect(() => {
    if (!host || runningCount === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAuthAndDocuments().catch(() => undefined);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [host, loadAuthAndDocuments, runningCount]);

  const onUpload = async () => {
    if (!selectedFile || !auth?.shopId || !host) {
      return;
    }

    try {
      setErrorMessage(null);
      setUploadState({ step: 'preparing', progress: 10, message: 'Preparing metadata' });

      const checksum = await sha256Hex(selectedFile);

      const createResponse = await apiFetch(`/v1/shops/${auth.shopId}/documents`, {
        host,
        method: 'POST',
        body: JSON.stringify({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          byteSize: selectedFile.size,
          sha256: checksum,
          vendorHint: vendorHint.trim() || undefined,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(
          await buildApiError(createResponse, `Create upload failed (${createResponse.status})`),
        );
      }

      const createJson = (await createResponse.json()) as {
        documentId: string;
        versionId: string;
        uploadUrl: string;
      };

      setUploadState({ step: 'uploading', progress: 45, message: 'Uploading to storage' });

      const uploadResponse = await fetch(createJson.uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': selectedFile.type || 'application/octet-stream',
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed (${uploadResponse.status})`);
      }

      setUploadState({ step: 'completing', progress: 80, message: 'Finalizing upload' });

      const completeResponse = await apiFetch(
        `/v1/documents/${createJson.documentId}/versions/${createJson.versionId}/complete`,
        {
          host,
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      if (!completeResponse.ok) {
        throw new Error(`Complete upload failed (${completeResponse.status})`);
      }

      setUploadState({ step: 'done', progress: 100, message: 'Upload complete' });
      setSelectedFile(null);
      setVendorHint('');
      await loadAuthAndDocuments();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setErrorMessage(message);
      setUploadState({ step: 'error', progress: 0, message: message });
    }
  };

  if (!host) {
    return (
      <Page title="Uploads">
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="400">
                <StatePanel
                  kind="error"
                  title="Missing host context"
                  message="Re-open the app from Shopify Admin so embedded session parameters are available."
                />
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Uploads">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <div className="lw-page-stack lw-animate-in">
                <div className="lw-hero">
                  <span className="lw-eyebrow">Evidence Intake</span>
                  <div className="lw-title">
                    <Text as="h2" variant="headingMd">
                      Invoice Upload
                    </Text>
                  </div>
                  <div className="lw-subtitle">
                    <Text as="p" variant="bodySm">
                      Protected upload path for billing evidence and OCR normalization.
                    </Text>
                  </div>
                  <Box paddingBlockStart="200">
                    <span className="lw-inline-chip lw-inline-chip--strong">
                      shop: {auth?.shopDomain ?? 'unresolved'}
                    </span>{' '}
                    <span className="lw-inline-chip">Accepted: PDF, CSV, PNG, JPG</span>{' '}
                    <span className="lw-inline-chip">progress: {uploadState.step}</span>{' '}
                    {selectedFile && <span className="lw-inline-chip">{selectedFile.name}</span>}
                  </Box>
                </div>

                <div className="lw-summary-grid">
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Total documents</div>
                    <div className="lw-metric-value">{documents.length}</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Completed</div>
                    <div className="lw-metric-value">{completedCount}</div>
                    <div className="lw-metric-hint">done, uploaded, normalized, detected</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">In progress</div>
                    <div className="lw-metric-value">{runningCount}</div>
                  </div>
                  <div className="lw-metric lw-metric--compact">
                    <div className="lw-metric-label">Failed</div>
                    <div className="lw-metric-value">{failedCount}</div>
                  </div>
                </div>

                <div className="lw-content-box">
                  <div
                    className={`lw-upload-dropzone${dragOver ? ' lw-upload-dropzone--active' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label="Drop invoice files or press Enter to choose file"
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOver(false);
                      const file = event.dataTransfer.files.item(0);
                      if (file) {
                        setSelectedFile(file);
                      }
                    }}
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <Text as="p" variant="bodySm" tone="subdued">
                      Drop a file here or choose one manually
                    </Text>
                    <Box paddingBlockStart="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        File limits: PDF, CSV, PNG, JPG - keep documents within your plan upload
                        quota.
                      </Text>
                    </Box>
                    <Box paddingBlockStart="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Privacy: uploaded invoices are stored in private object storage and accessed
                        through short-lived signed URLs only.
                      </Text>
                    </Box>
                    <Box paddingBlockStart="100">
                      <TextField
                        label="Vendor hint (optional but recommended)"
                        value={vendorHint}
                        onChange={setVendorHint}
                        autoComplete="off"
                        placeholder="e.g. Klaviyo, Mailgun, Shopify app name"
                      />
                    </Box>
                    <Box paddingBlockStart="200">
                      <input
                        id="upload-file-input"
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,text/csv,image/png,image/jpeg"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.item(0) ?? null;
                          setSelectedFile(file);
                        }}
                      />
                    </Box>
                  </div>

                  <Box paddingBlockStart="300">
                    <Text as="p" variant="bodySm">
                      Selected:{' '}
                      {selectedFile
                        ? `${selectedFile.name} (${selectedFile.type || 'unknown'})`
                        : 'none'}
                    </Text>
                  </Box>

                  {uploadState.step !== 'idle' && (
                    <Box paddingBlockStart="300">
                      <ProgressBar progress={uploadState.progress} size="small" />
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {uploadState.message ?? 'Processing'}
                        </Text>
                      </Box>
                    </Box>
                  )}

                  {errorMessage && (
                    <Box paddingBlockStart="300">
                      <InlineError message={errorMessage} fieldID="upload-file-input" />
                      <Box paddingBlockStart="150">
                        <Button
                          onClick={() => {
                            setUploadState({ step: 'idle', progress: 0 });
                            setErrorMessage(null);
                          }}
                        >
                          Re-enter upload flow
                        </Button>
                      </Box>
                    </Box>
                  )}

                  <Box paddingBlockStart="300">
                    <Button
                      variant="primary"
                      onClick={onUpload}
                      disabled={!canStartUpload || uploadQuotaReached}
                    >
                      Upload file
                    </Button>
                    {!canUpload(auth?.roles ?? []) ? (
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {uploadBlockedReason}
                        </Text>
                      </Box>
                    ) : null}
                    {uploadQuotaReached ? (
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          Upload quota reached for current plan ({billing?.usage.uploads}/
                          {billing?.limits.uploads}).
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                </div>
              </div>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <div className="lw-page-stack">
                <div className="lw-title">
                  <Text as="h3" variant="headingSm">
                    Recent Documents
                  </Text>
                </div>
                {documents.length === 0 ? (
                  <StatePanel
                    kind="empty"
                    title="No evidence uploaded"
                    message="Upload an invoice to start extraction, normalization, and leak detection."
                  />
                ) : (
                  <div className="lw-table-wrap">
                    <table className="lw-table">
                      <thead>
                        <tr>
                          <th>File</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Recovery</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((document) => {
                          const latest = document.versions?.[0];
                          return (
                            <tr key={document.id}>
                              <td>
                                <Text as="p" variant="bodySm">
                                  {latest?.fileName ?? document.id}
                                </Text>
                                {document.vendorHint ? (
                                  <div className="lw-metric-hint">
                                    vendor: {document.vendorHint}
                                  </div>
                                ) : null}
                                <Box paddingBlockStart="100">
                                  <Button
                                    onClick={() => {
                                      const versionQuery = latest?.id
                                        ? `?versionId=${encodeURIComponent(latest.id)}`
                                        : '';
                                      navigateEmbedded(
                                        `/app/documents/${document.id}${versionQuery}`,
                                        {
                                          host,
                                          shop,
                                        },
                                      );
                                    }}
                                  >
                                    Open detail
                                  </Button>
                                </Box>
                              </td>
                              <td>
                                <Badge tone={latest ? statusTone(latest.status) : 'info'}>
                                  {latest?.status ?? 'UNKNOWN'}
                                </Badge>
                              </td>
                              <td>{new Date(document.createdAt).toLocaleString()}</td>
                              <td>
                                {latest?.status.endsWith('FAILED') ? (
                                  <div className="lw-page-stack">
                                    <Text as="p" variant="bodySm" tone="critical">
                                      {latest.errorCode ?? 'PROCESSING_FAILED'}
                                    </Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      {latest.errorMessage ??
                                        mapErrorCodeToHint(latest.errorCode ?? null)}
                                    </Text>
                                    <Button
                                      onClick={() => {
                                        setErrorMessage(
                                          mapErrorCodeToHint(latest.errorCode ?? null),
                                        );
                                        fileInputRef.current?.focus();
                                      }}
                                    >
                                      Re-upload now
                                    </Button>
                                  </div>
                                ) : (
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    n/a
                                  </Text>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
