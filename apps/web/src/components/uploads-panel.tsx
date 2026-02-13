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
} from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../lib/api/fetcher';
import { canUpload, writeAccessReason } from '../lib/auth/roles';
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

function statusTone(status: string): 'info' | 'success' | 'attention' | 'critical' {
  if (status.endsWith('FAILED')) {
    return 'critical';
  }
  if (status === 'DONE' || status === 'UPLOADED' || status === 'NORMALIZED') {
    return 'success';
  }
  if (status.endsWith('RUNNING') || status === 'CREATED') {
    return 'attention';
  }
  return 'info';
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

export function UploadsPanel({ host }: { host: string | null }) {
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ step: 'idle', progress: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const uploadBlockedReason = writeAccessReason(auth?.roles ?? []);
  const latestStatuses = useMemo(
    () => documents.map((document) => document.versions?.[0]?.status ?? 'UNKNOWN'),
    [documents],
  );
  const completedCount = useMemo(
    () =>
      latestStatuses.filter(
        (status) => status === 'DONE' || status === 'UPLOADED' || status === 'NORMALIZED',
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
  }, [host]);

  useEffect(() => {
    void loadAuthAndDocuments().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
    });
  }, [loadAuthAndDocuments]);

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
                    <div className="lw-metric-hint">done, uploaded, normalized</div>
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
                    <Box paddingBlockStart="200">
                      <input
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
                      <InlineError message={errorMessage} fieldID="upload-error" />
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
                    <Button variant="primary" onClick={onUpload} disabled={!canStartUpload}>
                      Upload file
                    </Button>
                    {!canUpload(auth?.roles ?? []) ? (
                      <Box paddingBlockStart="100">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {uploadBlockedReason}
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
                              </td>
                              <td>
                                <Badge tone={latest ? statusTone(latest.status) : 'info'}>
                                  {latest?.status ?? 'UNKNOWN'}
                                </Badge>
                              </td>
                              <td>{new Date(document.createdAt).toLocaleString()}</td>
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
