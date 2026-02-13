'use client';

import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { AppProvider, Box, Button, Card, Layout, Page, Text, TextField } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';
import { canUpload, writeAccessReason } from '../../../../lib/auth/roles';
import { StatePanel } from '../../../../components/common/StatePanel';

function buildTarget(host: string | null, shop: string | null): string {
  const params = new URLSearchParams();
  if (host) {
    params.set('host', host);
  }
  if (shop) {
    params.set('shop', shop);
  }
  const query = params.toString();
  return query ? `/app/settings/billing?${query}` : '/app/settings/billing';
}

type ShopSettings = {
  currency: string;
  timezone: string;
  contactEmail: string | null;
};

type AuthMe = {
  shopId: string;
  roles: string[];
};

function SettingsRootContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [roles, setRoles] = useState<string[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canWrite = canUpload(roles);
  const blockedReason = writeAccessReason(roles);

  const load = useCallback(async () => {
    if (!host) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const meResponse = await apiFetch('/v1/auth/me', { host });
      if (!meResponse.ok) {
        throw new Error(`Auth check failed (${meResponse.status})`);
      }

      const me = (await meResponse.json()) as AuthMe;
      setRoles(me.roles ?? []);
      setShopId(me.shopId);

      const settingsResponse = await apiFetch(`/v1/shops/${me.shopId}/settings`, { host });
      if (!settingsResponse.ok) {
        throw new Error(`Settings fetch failed (${settingsResponse.status})`);
      }

      const settings = (await settingsResponse.json()) as ShopSettings;
      setCurrency(settings.currency);
      setTimezone(settings.timezone);
      setContactEmail(settings.contactEmail ?? '');
      setError(null);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!host || !shopId || !canWrite) {
      return;
    }

    const nextCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(nextCurrency)) {
      setError('Currency must be a three-letter uppercase code.');
      return;
    }

    const nextTimezone = timezone.trim();
    if (nextTimezone.length < 2) {
      setError('Timezone is required.');
      return;
    }

    const nextContactEmail = contactEmail.trim();
    if (nextContactEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextContactEmail)) {
      setError('Contact email must be a valid email format.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/v1/shops/${shopId}/settings`, {
        host,
        method: 'PATCH',
        body: JSON.stringify({
          currency: nextCurrency,
          timezone: nextTimezone,
          contactEmail: nextContactEmail || undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(`Settings update failed (${response.status})`);
      }

      const settings = (await response.json()) as ShopSettings;
      setCurrency(settings.currency);
      setTimezone(settings.timezone);
      setContactEmail(settings.contactEmail ?? '');
      setError(null);
      setSuccess('Settings saved.');
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      setSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const appBridgeConfig =
    host && apiKey
      ? {
          apiKey,
          host,
          forceRedirect: true,
        }
      : null;

  const content = (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <Box padding="400">
              {loading ? (
                <StatePanel kind="loading" message="Loading store settings." />
              ) : error ? (
                <StatePanel kind="error" message={error} />
              ) : (
                <div className="lw-page-stack lw-animate-in">
                  <div className="lw-hero">
                    <span className="lw-eyebrow">Store Settings</span>
                    <div className="lw-title">
                      <Text as="h2" variant="headingMd">
                        Currency, timezone, and support contact
                      </Text>
                    </div>
                  </div>

                  <div className="lw-content-box">
                    <TextField
                      label="Currency"
                      value={currency}
                      onChange={setCurrency}
                      autoComplete="off"
                      maxLength={3}
                    />
                    <Box paddingBlockStart="200">
                      <TextField
                        label="Timezone"
                        value={timezone}
                        onChange={setTimezone}
                        autoComplete="off"
                        placeholder="Asia/Seoul"
                      />
                    </Box>
                    <Box paddingBlockStart="200">
                      <TextField
                        label="Contact email"
                        value={contactEmail}
                        onChange={setContactEmail}
                        autoComplete="email"
                      />
                    </Box>
                    <Box paddingBlockStart="200">
                      <div className="lw-actions-row">
                        <Button
                          onClick={save}
                          loading={saving}
                          disabled={!canWrite}
                          variant="primary"
                        >
                          Save settings
                        </Button>
                        <Button
                          onClick={() => {
                            window.location.assign(buildTarget(host, shop));
                          }}
                        >
                          Open billing settings
                        </Button>
                      </div>
                    </Box>
                    {!canWrite ? (
                      <Box paddingBlockStart="200">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {blockedReason}
                        </Text>
                      </Box>
                    ) : null}
                    {success ? (
                      <Box paddingBlockStart="200">
                        <Text as="p" variant="bodySm" tone="success">
                          {success}
                        </Text>
                      </Box>
                    ) : null}
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

export default function SettingsRootPage() {
  return (
    <Suspense>
      <AppProvider i18n={enTranslations}>
        <SettingsRootContent />
      </AppProvider>
    </Suspense>
  );
}
