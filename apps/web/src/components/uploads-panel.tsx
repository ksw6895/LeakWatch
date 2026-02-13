'use client';

import { Badge, Box, Button, Card, InlineError, Layout, Page, ProgressBar, Text } from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../lib/api/fetcher';

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

  const canUpload = useMemo(
    () => Boolean(host && auth?.shopId && selectedFile && uploadState.step !== 'uploading'),
    [host, auth?.shopId, selectedFile, uploadState.step],
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
          await buildApiError(
            createResponse,
            `Create upload failed (${createResponse.status})`,
          ),
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

  return (
    <Page title="Uploads">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h2" variant="headingMd">
                Invoice Upload
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                shop: {auth?.shopDomain ?? 'unresolved'}
              </Text>

              <Box paddingBlockStart="300">
                <div
                  style={{
                    border: `2px dashed ${dragOver ? '#005bd3' : '#8a8a8a'}`,
                    borderRadius: 12,
                    padding: 24,
                    background: dragOver ? '#f2f7fe' : '#fafafa',
                  }}
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
                  <Text as="p" variant="bodyMd">
                    Drop a file here or choose one manually
                  </Text>
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
              </Box>

              <Box paddingBlockStart="300">
                <Text as="p" variant="bodySm">
                  Selected: {selectedFile ? `${selectedFile.name} (${selectedFile.type || 'unknown'})` : 'none'}
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
                </Box>
              )}

              <Box paddingBlockStart="300">
                <Button variant="primary" onClick={onUpload} disabled={!canUpload}>
                  Upload File
                </Button>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Box padding="400">
              <Text as="h3" variant="headingSm">
                Recent Documents
              </Text>
              <Box paddingBlockStart="200">
                {documents.length === 0 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    No documents yet
                  </Text>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 0' }}>File</th>
                        <th style={{ textAlign: 'left', padding: '8px 0' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '8px 0' }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => {
                        const latest = document.versions?.[0];
                        return (
                          <tr key={document.id}>
                            <td style={{ padding: '8px 0' }}>{latest?.fileName ?? document.id}</td>
                            <td style={{ padding: '8px 0' }}>
                              <Badge tone={latest ? statusTone(latest.status) : 'info'}>
                                {latest?.status ?? 'UNKNOWN'}
                              </Badge>
                            </td>
                            <td style={{ padding: '8px 0' }}>
                              {new Date(document.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
