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
    <nav className="lw-actions-row" aria-label="Settings sections">
      <Button
        variant={active === 'general' ? 'primary' : 'tertiary'}
        onClick={() => {
          if (active !== 'general') {
            navigateEmbedded('/app/settings', { host, shop });
          }
        }}
      >
        General settings
      </Button>
      <Button
        variant={active === 'billing' ? 'primary' : 'tertiary'}
        onClick={() => {
          if (active !== 'billing') {
            navigateEmbedded('/app/settings/billing', { host, shop });
          }
        }}
      >
        Billing settings
      </Button>
    </nav>
  );
}
