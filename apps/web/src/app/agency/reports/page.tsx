'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../lib/api/fetcher';

type AuthMe = {
  orgId: string;
  roles: string[];
};

type Shop = {
  id: string;
  shopifyDomain: string;
  displayName: string | null;
};

type Report = {
  id: string;
  period: 'WEEKLY' | 'MONTHLY';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

function withContext(pathname: string, host: string | null, shop: string | null): string {
  const params = new URLSearchParams();
  if (host) {
    params.set('host', host);
  }
  if (shop) {
    params.set('shop', shop);
  }
  const query = params.toString();
  return query.length > 0 ? `${pathname}?${query}` : pathname;
}

function AgencyReportsPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }

    void (async () => {
      try {
        const meResponse = await apiFetch('/v1/auth/me', { host });
        if (!meResponse.ok) {
          throw new Error(`Auth failed (${meResponse.status})`);
        }
        const me = (await meResponse.json()) as AuthMe;
        const canAccess = me.roles.some((role) =>
          ['OWNER', 'MEMBER', 'AGENCY_ADMIN', 'AGENCY_VIEWER'].includes(role),
        );
        if (!canAccess) {
          throw new Error(
            'Agency reports require OWNER, MEMBER, AGENCY_ADMIN, or AGENCY_VIEWER role.',
          );
        }
        const shopsResponse = await apiFetch(`/v1/orgs/${me.orgId}/shops`, { host });
        if (!shopsResponse.ok) {
          throw new Error(`Shops fetch failed (${shopsResponse.status})`);
        }
        const shopList = (await shopsResponse.json()) as Shop[];
        setShops(shopList);
        if (shopList[0]) {
          setSelectedShopId(shopList[0].id);
        }
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host]);

  useEffect(() => {
    if (!host || !selectedShopId) {
      return;
    }
    void (async () => {
      try {
        const response = await apiFetch(
          `/v1/reports?shopId=${encodeURIComponent(selectedShopId)}`,
          {
            host,
          },
        );
        if (!response.ok) {
          throw new Error(`Reports fetch failed (${response.status})`);
        }
        setReports((await response.json()) as Report[]);
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host, selectedShopId]);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Agency Reports</h1>
      {!host ? <p>Missing host parameter. Re-open from Shopify Admin.</p> : null}
      {error ? <p>{error}</p> : null}

      <section>
        <label htmlFor="shop-select">Shop</label>{' '}
        <select
          id="shop-select"
          value={selectedShopId}
          onChange={(event) => {
            setSelectedShopId(event.target.value);
          }}
        >
          {shops.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName || item.shopifyDomain}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h2>Recent Reports</h2>
        {reports.length === 0 ? (
          <p>No reports found for selected shop.</p>
        ) : (
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                {report.period} {new Date(report.periodStart).toLocaleDateString()} -{' '}
                {new Date(report.periodEnd).toLocaleDateString()} |{' '}
                <Link href={withContext(`/app/reports/${report.id}`, host, shop)}>
                  Open in embedded UI
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedShopId ? (
        <p>
          <Link href={withContext(`/agency/shops/${selectedShopId}`, host, shop)}>
            Open selected shop workspace
          </Link>
        </p>
      ) : null}
    </main>
  );
}

export default function AgencyReportsPage() {
  return (
    <Suspense>
      <AgencyReportsPageContent />
    </Suspense>
  );
}
