'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import {
  AppProvider,
  Badge,
  Box,
  Button,
  Card,
  Layout,
  Modal,
  Page,
  Text,
  TextField,
} from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';
import { trackEvent } from '../../../../../lib/analytics/track';
import { StatePanel } from '../../../../../components/common/StatePanel';
import { canApproveSend, writeAccessReason } from '../../../../../lib/auth/roles';
import { navigateEmbedded } from '../../../../../lib/navigation/embedded';

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
  displayStatus?: string;
  latestRunStatus?: string | null;
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

type AuthMe = {
  roles: string[];
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
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const canWrite = canApproveSend(roles);
  const blockedReason = writeAccessReason(roles);

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
    const meResponse = await apiFetch('/v1/auth/me', { host });
    if (meResponse.ok) {
      const me = (await meResponse.json()) as AuthMe;
      setRoles(me.roles ?? []);
    }
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

    const recipient = toEmail.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(recipient)) {
      setError('Enter a valid recipient email before saving.');
      return;
    }

    const ccList = ccEmails
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (ccList.some((value) => !emailPattern.test(value))) {
      setError('Each CC email must use a valid format.');
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch(`/v1/action-requests/${actionRequest.id}`, {
        host,
        method: 'PATCH',
        body: JSON.stringify({
          toEmail: recipient,
          ccEmails: ccList,
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

    const recipient = toEmail.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(recipient)) {
      setError('Enter a valid recipient email before approve and send.');
      return;
    }

    const ccList = ccEmails
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (ccList.some((value) => !emailPattern.test(value))) {
      setError('Each CC email must use a valid format before approve and send.');
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
      void trackEvent(host, 'action_approved_sent', {
        host,
        shop,
        actionId: actionRequest.id,
        findingId: actionRequest.finding.id,
      });
      await load();
      setError(null);
      setApproveModalOpen(false);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const updateManualStatus = async (status: 'WAITING_REPLY' | 'RESOLVED') => {
    if (!host || !actionRequest) {
      return;
    }

    setBusy(true);
    try {
      const response = await apiFetch(`/v1/action-requests/${actionRequest.id}/status`, {
        host,
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(`Status update failed (${response.status})`);
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
                      <StatePanel kind="error" message={error} />
                    ) : !actionRequest ? (
                      <StatePanel
                        kind="loading"
                        message="Loading action request and send timeline."
                      />
                    ) : (
                      <div className="lw-page-stack lw-animate-in">
                        <div className="lw-hero">
                          <span className="lw-eyebrow">Action Detail</span>
                          <div className="lw-title">
                            <Text as="h2" variant="headingMd">
                              {actionRequest.finding.title}
                            </Text>
                          </div>
                          <Box paddingBlockStart="200">
                            <Badge>{actionRequest.type}</Badge>{' '}
                            <span className="lw-inline-chip">
                              status: {actionRequest.displayStatus ?? actionRequest.status}
                            </span>{' '}
                            <span className="lw-inline-chip">
                              latest run: {actionRequest.latestRunStatus ?? 'n/a'}
                            </span>{' '}
                            <span className="lw-inline-chip">
                              savings: {actionRequest.finding.estimatedSavingsAmount}{' '}
                              {actionRequest.finding.currency}
                            </span>
                          </Box>
                          <Box paddingBlockStart="200">
                            <Text as="p" variant="bodySm" tone="subdued">
                              {actionRequest.finding.summary}
                            </Text>
                          </Box>
                        </div>

                        <div className="lw-content-box">
                          <Text as="h3" variant="headingSm">
                            Editable outreach content
                          </Text>
                          <Box paddingBlockStart="200">
                            <Text as="p" variant="bodySm" tone="subdued">
                              Update recipient and message fields before approval.
                            </Text>
                          </Box>
                          <Box paddingBlockStart="200">
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
                        </div>

                        <div className="lw-content-box">
                          <Text as="h3" variant="headingSm">
                            Immutable finding context
                          </Text>
                          <Box paddingBlockStart="150">
                            <Text as="p" variant="bodySm" tone="subdued">
                              {actionRequest.finding.summary}
                            </Text>
                            <Text as="p" variant="bodySm">
                              Savings: {actionRequest.finding.estimatedSavingsAmount}{' '}
                              {actionRequest.finding.currency}
                            </Text>
                          </Box>
                          <Box paddingBlockStart="300">
                            <div className="lw-actions-row">
                              <Button
                                onClick={saveDraft}
                                disabled={busy || actionRequest.status !== 'DRAFT' || !canWrite}
                              >
                                Save draft
                              </Button>
                              <Button
                                variant="primary"
                                onClick={() => {
                                  setApproveModalOpen(true);
                                }}
                                disabled={busy || actionRequest.status !== 'DRAFT' || !canWrite}
                              >
                                Approve and send
                              </Button>
                              <Button
                                onClick={downloadEvidence}
                                disabled={busy || !actionRequest.attachmentKey}
                              >
                                Download evidence pack
                              </Button>
                              <Button
                                onClick={() => {
                                  void updateManualStatus('WAITING_REPLY');
                                }}
                                disabled={busy || actionRequest.status !== 'APPROVED' || !canWrite}
                              >
                                Mark waiting reply
                              </Button>
                              <Button
                                onClick={() => {
                                  void updateManualStatus('RESOLVED');
                                }}
                                disabled={busy || actionRequest.status !== 'APPROVED' || !canWrite}
                              >
                                Mark resolved
                              </Button>
                              <Button
                                onClick={() => {
                                  navigateEmbedded('/app/actions', { host, shop });
                                }}
                              >
                                Back to actions
                              </Button>
                            </div>
                            {!canWrite ? (
                              <Box paddingBlockStart="150">
                                <Text as="p" variant="bodySm" tone="subdued">
                                  {blockedReason}
                                </Text>
                              </Box>
                            ) : null}
                          </Box>
                        </div>

                        <div className="lw-content-box">
                          <div className="lw-title">
                            <Text as="h3" variant="headingSm">
                              Status timeline
                            </Text>
                          </div>
                          <Box paddingBlockStart="200">
                            {actionRequest.runs.length === 0 ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                No send runs yet
                              </Text>
                            ) : (
                              <div className="lw-list">
                                {actionRequest.runs.map((run) => (
                                  <div key={run.id} className="lw-list-item">
                                    <Text as="p" variant="bodySm">
                                      {run.status} at {new Date(run.createdAt).toLocaleString()}
                                    </Text>
                                    {run.status === 'FAILED' ? (
                                      <Badge tone="critical">Failed run</Badge>
                                    ) : null}
                                    {run.mailgunMessageId ? (
                                      <div className="lw-metric-hint">
                                        message-id: {run.mailgunMessageId}
                                      </div>
                                    ) : null}
                                    {run.lastError ? (
                                      <Text as="p" variant="bodySm" tone="critical">
                                        error: {run.lastError}
                                      </Text>
                                    ) : null}
                                    {run.mailEvents.length > 0 ? (
                                      <Box paddingBlockStart="100">
                                        {run.mailEvents.map((event) => (
                                          <Text
                                            key={event.id}
                                            as="p"
                                            variant="bodySm"
                                            tone="subdued"
                                          >
                                            - {event.event} (
                                            {new Date(event.occurredAt).toLocaleString()})
                                          </Text>
                                        ))}
                                      </Box>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </Box>
                        </div>

                        <Modal
                          open={approveModalOpen}
                          title="Approve and send"
                          onClose={() => {
                            setApproveModalOpen(false);
                          }}
                          primaryAction={{
                            content: 'Approve and send',
                            destructive: true,
                            loading: busy,
                            onAction: () => {
                              void approve();
                            },
                          }}
                          secondaryActions={[
                            {
                              content: 'Cancel',
                              onAction: () => {
                                setApproveModalOpen(false);
                              },
                            },
                          ]}
                        >
                          <Modal.Section>
                            <Text as="p" variant="bodyMd">
                              This action will queue an outbound vendor email and usage metering.
                              Confirm recipient fields before continuing.
                            </Text>
                          </Modal.Section>
                        </Modal>
                      </div>
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
