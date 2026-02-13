'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import {
  AppProvider,
  Badge,
  Box,
  Button,
  Card,
  Layout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';

type MailEvent = {
  id: string;
  event: string;
  occurredAt: string;
};

type ActionRun = {
  id: string;
  status: string;
  mailgunMessageId: string | null;
  lastError: string | null;
  createdAt: string;
  mailEvents: MailEvent[];
};

type ActionRequestDetail = {
  id: string;
  status: string;
  type: string;
  toEmail: string;
  ccEmails: string[];
  subject: string;
  bodyMarkdown: string;
  attachmentKey: string | null;
  finding: {
    id: string;
    title: string;
    summary: string;
    estimatedSavingsAmount: string;
    currency: string;
  };
  runs: ActionRun[];
};

function ActionDetailContent() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [actionRequest, setActionRequest] = useState<ActionRequestDetail | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!host || !params.id) {
      return;
    }

    const response = await apiFetch(`/v1/action-requests/${params.id}`, { host });
    if (!response.ok) {
      throw new Error(`Action request fetch failed (${response.status})`);
    }

    const json = (await response.json()) as ActionRequestDetail;
    setActionRequest(json);
    setSubject(json.subject);
    setBodyMarkdown(json.bodyMarkdown);
    setToEmail(json.toEmail);
    setCcEmails(json.ccEmails.join(', '));
  }, [host, params.id]);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [load]);

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const saveDraft = async () => {
    if (!host || !actionRequest) {
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/action-requests/${actionRequest.id}`, {
        host,
        method: 'PATCH',
        body: JSON.stringify({
          toEmail,
          ccEmails: ccEmails
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
          subject,
          bodyMarkdown,
        }),
      });
      if (!response.ok) {
        throw new Error(`Draft save failed (${response.status})`);
      }
      await load();
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!host || !actionRequest) {
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/action-requests/${actionRequest.id}/approve`, {
        host,
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`Approve failed (${response.status})`);
      }
      await load();
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const downloadEvidence = async () => {
    if (!host || !actionRequest) {
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/evidence-packs/${actionRequest.id}/download`, { host });
      if (!response.ok) {
        throw new Error(`Download URL fetch failed (${response.status})`);
      }
      const json = (await response.json()) as { downloadUrl: string };
      window.location.assign(json.downloadUrl);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppProvider i18n={enTranslations}>
      {appBridgeConfig ? (
        <AppBridgeProvider config={appBridgeConfig}>
          <Page title="Action Detail">
            <Layout>
              <Layout.Section>
                <Card>
                  <Box padding="400">
                    {error ? (
                      <Text as="p" variant="bodyMd" tone="critical">
                        {error}
                      </Text>
                    ) : !actionRequest ? (
                      <Text as="p" variant="bodyMd">
                        Loading...
                      </Text>
                    ) : (
                      <>
                        <Text as="h2" variant="headingMd">
                          {actionRequest.finding.title}
                        </Text>
                        <Box paddingBlockStart="200">
                          <Badge>{actionRequest.type}</Badge>
                          <Box paddingBlockStart="100">
                            <Text as="p" variant="bodySm" tone="subdued">
                              Status: {actionRequest.status}
                            </Text>
                          </Box>
                        </Box>

                        <Box paddingBlockStart="300">
                          <TextField
                            label="To"
                            value={toEmail}
                            onChange={setToEmail}
                            autoComplete="email"
                          />
                          <Box paddingBlockStart="200">
                            <TextField
                              label="CC (comma separated)"
                              value={ccEmails}
                              onChange={setCcEmails}
                              autoComplete="off"
                            />
                          </Box>
                          <Box paddingBlockStart="200">
                            <TextField
                              label="Subject"
                              value={subject}
                              onChange={setSubject}
                              autoComplete="off"
                            />
                          </Box>
                          <Box paddingBlockStart="200">
                            <TextField
                              label="Body"
                              value={bodyMarkdown}
                              onChange={setBodyMarkdown}
                              multiline={8}
                              autoComplete="off"
                            />
                          </Box>
                        </Box>

                        <Box paddingBlockStart="300">
                          <Button
                            onClick={saveDraft}
                            disabled={busy || actionRequest.status !== 'DRAFT'}
                          >
                            Save draft
                          </Button>
                          <Box paddingBlockStart="200">
                            <Button
                              variant="primary"
                              onClick={approve}
                              disabled={busy || actionRequest.status !== 'DRAFT'}
                            >
                              Approve and send
                            </Button>
                          </Box>
                          <Box paddingBlockStart="200">
                            <Button
                              onClick={downloadEvidence}
                              disabled={busy || !actionRequest.attachmentKey}
                            >
                              Download evidence pack
                            </Button>
                          </Box>
                          <Box paddingBlockStart="200">
                            <Button
                              onClick={() => {
                                const target = new URL('/app/actions', window.location.origin);
                                if (host) {
                                  target.searchParams.set('host', host);
                                }
                                if (shop) {
                                  target.searchParams.set('shop', shop);
                                }
                                window.location.assign(target.toString());
                              }}
                            >
                              Back to actions
                            </Button>
                          </Box>
                        </Box>

                        <Box paddingBlockStart="400">
                          <Text as="h3" variant="headingSm">
                            Status timeline
                          </Text>
                          <Box paddingBlockStart="200">
                            {actionRequest.runs.length === 0 ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                No send runs yet
                              </Text>
                            ) : (
                              actionRequest.runs.map((run) => (
                                <Box key={run.id} paddingBlockEnd="300">
                                  <Text as="p" variant="bodySm">
                                    {run.status} at {new Date(run.createdAt).toLocaleString()}
                                  </Text>
                                  {run.mailgunMessageId ? (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                      message-id: {run.mailgunMessageId}
                                    </Text>
                                  ) : null}
                                  {run.lastError ? (
                                    <Text as="p" variant="bodySm" tone="critical">
                                      error: {run.lastError}
                                    </Text>
                                  ) : null}
                                  {run.mailEvents.map((event) => (
                                    <Text key={event.id} as="p" variant="bodySm" tone="subdued">
                                      - {event.event} ({new Date(event.occurredAt).toLocaleString()}
                                      )
                                    </Text>
                                  ))}
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
        <Page title="Action Detail" />
      )}
    </AppProvider>
  );
}

export default function ActionDetailPage() {
  return (
    <Suspense>
      <ActionDetailContent />
    </Suspense>
  );
}
