'use client';

import { useSearchParams } from 'next/navigation';

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

export default function SettingsRootPage() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');

  return (
    <div style={{ padding: 16 }}>
      <StatePanel
        kind="empty"
        title="Settings overview"
        message="General settings are under construction. Use Billing settings for plan and usage controls."
        actionLabel="Open billing settings"
        onAction={() => {
          window.location.assign(buildTarget(host, shop));
        }}
      />
    </div>
  );
}
