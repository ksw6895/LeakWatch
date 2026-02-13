'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import {
  AppProvider,
  Box,
  Button,
  Card,
  InlineError,
  Layout,
  Modal,
  Page,
  Select,
  Text,
  TextField,
} from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../../lib/api/fetcher';
import { trackEvent } from '../../../../../lib/analytics/track';
import { StatePanel } from '../../../../../components/common/StatePanel';
import { canUpload, writeAccessReason } from '../../../../../lib/auth/roles';
import { navigateEmbedded } from '../../../../../lib/navigation/embedded';

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

type AuthMe = {
  roles: string[];
};

type ActionType = 'REFUND_REQUEST' | 'CANCEL_REQUEST' | 'DOWNGRADE_REQUEST' | 'CLARIFICATION';

function LeaksDetailContent() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [actionType, setActionType] = useState<ActionType>('CLARIFICATION');
  const [toEmail, setToEmail] = useState<string>('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const canMutate = canUpload(roles);
  const blockedReason = writeAccessReason(roles);

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
        const me = await apiFetch('/v1/auth/me', { host });
        if (me.ok) {
          const meJson = (await me.json()) as AuthMe;
          setRoles(meJson.roles ?? []);
        }
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host, params.id]);

  useEffect(() => {
    if (!finding?.id) {
      return;
    }
    void trackEvent(host, 'finding_detail_viewed', {
      host,
      shop,
      findingId: finding.id,
      status: finding.status,
    });
  }, [finding?.id, finding?.status, host, shop]);

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
      void trackEvent(host, 'finding_dismissed', {
        host,
        shop,
        findingId: finding.id,
      });
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

    const recipient = toEmail.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(recipient)) {
      setDraftError('Enter a valid recipient email before creating a draft.');
      return;
    }

    setBusy(true);
    setDraftError(null);
    try {
      const response = await apiFetch(`/v1/findings/${finding.id}/actions`, {
        host,
        method: 'POST',
        body: JSON.stringify({
          type: actionType,
          toEmail: recipient,
        }),
      });
      if (!response.ok) {
        throw new Error(`Create action draft failed (${response.status})`);
      }
      const json = (await response.json()) as { id: string };
      navigateEmbedded(`/app/actions/${json.id}`, { host, shop });
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
                      <StatePanel kind="error" message={error} />
                    ) : !finding ? (
                      <StatePanel
                        kind="loading"
                        message="Loading finding evidence and confidence."
                      />
                    ) : (
                      <div className="lw-page-stack lw-animate-in">
                        <div className="lw-hero">
                          <span className="lw-eyebrow">Leak Detail</span>
                          <div className="lw-title">
                            <Text as="h2" variant="headingMd">
                              {finding.title}
                            </Text>
                          </div>
                          <Box paddingBlockStart="200">
                            <span className="lw-inline-chip">{finding.type}</span>{' '}
                            <span className="lw-inline-chip">status: {finding.status}</span>{' '}
                            <span className="lw-inline-chip">
                              confidence: {finding.confidence}%
                            </span>
                          </Box>
                          <Box paddingBlockStart="200">
                            <Text as="p" variant="bodySm">
                              {finding.summary}
                            </Text>
                          </Box>
                          <Box paddingBlockStart="100">
                            <Text as="p" variant="bodySm" tone="subdued">
                              Savings estimate: {finding.estimatedSavingsAmount} {finding.currency}
                            </Text>
                          </Box>
                        </div>

                        <div className="lw-content-box">
                          <div className="lw-summary-grid">
                            <Select
                              label="Action type"
                              options={[
                                { label: 'Refund request', value: 'REFUND_REQUEST' },
                                { label: 'Cancel request', value: 'CANCEL_REQUEST' },
                                { label: 'Downgrade request', value: 'DOWNGRADE_REQUEST' },
                                { label: 'Clarification', value: 'CLARIFICATION' },
                              ]}
                              value={actionType}
                              onChange={(value) => {
                                setActionType(value as ActionType);
                              }}
                            />
                            <TextField
                              label="Recipient email"
                              value={toEmail}
                              onChange={setToEmail}
                              autoComplete="email"
                            />
                          </div>
                          {draftError ? (
                            <Box paddingBlockStart="150">
                              <InlineError message={draftError} fieldID="action-draft-error" />
                            </Box>
                          ) : null}
                          <Box paddingBlockStart="200" />
                          <div className="lw-actions-row">
                            <Button
                              variant="primary"
                              disabled={busy || finding.status === 'DISMISSED' || !canMutate}
                              onClick={() => {
                                setDismissModalOpen(true);
                              }}
                            >
                              Dismiss finding
                            </Button>
                            <Button onClick={createActionDraft} disabled={busy || !canMutate}>
                              Create action draft
                            </Button>
                            <Button
                              onClick={() => {
                                navigateEmbedded('/app/leaks', { host, shop });
                              }}
                            >
                              Back to list
                            </Button>
                          </div>
                          {!canMutate ? (
                            <Box paddingBlockStart="200">
                              <Text as="p" variant="bodySm" tone="subdued">
                                {blockedReason}
                              </Text>
                            </Box>
                          ) : null}
                        </div>

                        <div className="lw-content-box">
                          <div className="lw-title">
                            <Text as="h3" variant="headingSm">
                              Evidence
                            </Text>
                          </div>
                          <Box paddingBlockStart="200">
                            {finding.evidence.length === 0 ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                No evidence attached
                              </Text>
                            ) : (
                              <div className="lw-list">
                                {finding.evidence.map((evidence) => (
                                  <div key={evidence.id} className="lw-list-item">
                                    <Text as="p" variant="bodySm">
                                      {evidence.kind}
                                    </Text>
                                    <div className="lw-metric-hint">{evidence.excerpt}</div>
                                    <pre className="lw-pre">
                                      {JSON.stringify(evidence.pointerJson, null, 2)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Box>
                        </div>

                        <Modal
                          open={dismissModalOpen}
                          title="Dismiss finding"
                          onClose={() => {
                            setDismissModalOpen(false);
                          }}
                          primaryAction={{
                            content: 'Dismiss now',
                            destructive: true,
                            loading: busy,
                            onAction: () => {
                              setDismissModalOpen(false);
                              void dismiss();
                            },
                          }}
                          secondaryActions={[
                            {
                              content: 'Cancel',
                              onAction: () => {
                                setDismissModalOpen(false);
                              },
                            },
                          ]}
                        >
                          <Modal.Section>
                            <Text as="p" variant="bodyMd">
                              This removes the finding from active leak triage. You can reopen it
                              later if the same pattern is detected again.
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
