'use client';

import { Button } from '@shopify/polaris';

import { navigateEmbedded } from '../../lib/navigation/embedded';

type SettingsSectionNavProps = {
  host: string | null;
  shop: string | null;
  active: 'general' | 'billing';
};

export function SettingsSectionNav({ host, shop, active }: SettingsSectionNavProps) {
  return (
    <div className="lw-actions-row" role="tablist" aria-label="Settings sections">
      <Button
        variant={active === 'general' ? 'primary' : 'tertiary'}
        disabled={active === 'general'}
        onClick={() => {
          navigateEmbedded('/app/settings', { host, shop });
        }}
      >
        General settings
      </Button>
      <Button
        variant={active === 'billing' ? 'primary' : 'tertiary'}
        disabled={active === 'billing'}
        onClick={() => {
          navigateEmbedded('/app/settings/billing', { host, shop });
        }}
      >
        Billing settings
      </Button>
    </div>
  );
}
