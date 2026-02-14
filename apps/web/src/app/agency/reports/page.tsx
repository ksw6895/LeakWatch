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
    <main className="lw-standalone-main">
      <div className="lw-standalone-stack">
        <section className="lw-standalone-card">
          <span className="lw-eyebrow">Agency Reports</span>
          <div className="lw-title">
            <h1>Cross-shop report access</h1>
          </div>
          {!host ? (
            <p className="lw-standalone-alert">
              Missing host parameter. Re-open from Shopify Admin.
            </p>
          ) : null}
          {error ? <p className="lw-standalone-alert">{error}</p> : null}

          <div className="lw-standalone-field">
            <label htmlFor="shop-select">Shop</label>
            <select
              id="shop-select"
              className="lw-standalone-select"
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
          </div>
        </section>

        <section className="lw-standalone-card">
          <div className="lw-title">
            <h2>Recent reports</h2>
          </div>
          {reports.length === 0 ? (
            <p className="lw-standalone-note">No reports found for selected shop.</p>
          ) : (
            <ul className="lw-standalone-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <strong>{report.period}</strong>{' '}
                  {new Date(report.periodStart).toLocaleDateString()} -{' '}
                  {new Date(report.periodEnd).toLocaleDateString()} |{' '}
                  <Link href={withContext(`/app/reports/${report.id}`, host, shop)}>
                    Open in embedded UI
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {selectedShopId ? (
            <div className="lw-standalone-links">
              <Link href={withContext(`/agency/shops/${selectedShopId}`, host, shop)}>
                Open selected shop workspace
              </Link>
            </div>
          ) : null}
        </section>
      </div>
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
