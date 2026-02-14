'use client';

import { Select } from '@shopify/polaris';
import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '../lib/api/fetcher';

type ShopOption = {
  id: string;
  shopifyDomain: string;
  displayName: string | null;
};

export function StoreSwitcher({
  host,
  currentShop,
}: {
  host: string | null;
  currentShop: string | null;
}) {
  const [shops, setShops] = useState<ShopOption[]>([]);

  useEffect(() => {
    if (!host) {
      return;
    }
    void (async () => {
      const response = await apiFetch('/v1/shops', { host });
      if (!response.ok) {
        return;
      }
      const json = (await response.json()) as ShopOption[];
      setShops(json);
    })();
  }, [host]);

  const options = useMemo(
    () =>
      shops.map((shop) => ({
        label: shop.displayName || shop.shopifyDomain,
        value: shop.shopifyDomain,
      })),
    [shops],
  );

  if (!currentShop || options.length < 2) {
    return null;
  }

  return (
    <aside className="lw-store-switcher" aria-label="Store selector">
      <p className="lw-store-switcher-label">Store scope</p>
      <p className="lw-store-switcher-value">{currentShop}</p>
      <div className="lw-store-switcher-control">
        <Select
          label="Store"
          labelHidden
          options={options}
          value={currentShop}
          onChange={(value) => {
            const next = new URL(window.location.href);
            next.searchParams.set('shop', value);
            window.location.assign(next.toString());
          }}
        />
      </div>
    </aside>
  );
}
