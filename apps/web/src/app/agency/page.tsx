'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../lib/api/fetcher';

type AuthMe = {
  orgId: string;
  roles: string[];
};

type AgencySummary = {
  shopsCount: number;
  totalSpend: string;
  potentialSavings: string;
  topFindingsAcrossShops: Array<{
    id: string;
    shopId: string;
    title: string;
    estimatedSavingsAmount: string;
    currency: string;
  }>;
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

function AgencyPortalPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const [summary, setSummary] = useState<AgencySummary | null>(null);
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
            'Agency portal requires OWNER, MEMBER, AGENCY_ADMIN, or AGENCY_VIEWER role.',
          );
        }

        const summaryResponse = await apiFetch(`/v1/orgs/${me.orgId}/summary`, { host });
        if (!summaryResponse.ok) {
          throw new Error(`Summary fetch failed (${summaryResponse.status})`);
        }

        setSummary((await summaryResponse.json()) as AgencySummary);
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host]);

  return (
    <main className="lw-standalone-main">
      <div className="lw-standalone-stack">
        <section className="lw-standalone-card">
          <span className="lw-eyebrow">Agency Portal</span>
          <div className="lw-title">
            <h1>Cross-shop operations workspace</h1>
          </div>
          <p className="lw-standalone-note">
            Tenant-scoped summary and direct drill-down links for multi-shop operations.
          </p>

          {!host ? (
            <p className="lw-standalone-alert">
              Missing <code>host</code> parameter. Open from Shopify Admin to restore embedded
              context.
            </p>
          ) : null}

          {error ? <p className="lw-standalone-alert">{error}</p> : null}

          {summary ? (
            <div className="lw-summary-grid">
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Connected shops</div>
                <div className="lw-metric-value">{summary.shopsCount}</div>
              </div>
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Total spend</div>
                <div className="lw-metric-value">{summary.totalSpend}</div>
              </div>
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Potential savings</div>
                <div className="lw-metric-value">{summary.potentialSavings}</div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="lw-standalone-card">
          <div className="lw-title">
            <h2>Operational links</h2>
          </div>
          <div className="lw-standalone-links">
            <Link href={withContext('/agency/reports', host, shop)}>Agency reports</Link>
            <Link href={withContext('/app/agency', host, shop)}>Embedded agency dashboard</Link>
          </div>

          {summary?.topFindingsAcrossShops.length ? (
            <>
              <p className="lw-standalone-note">Top findings across shops</p>
              <ul className="lw-standalone-list">
                {summary.topFindingsAcrossShops.slice(0, 5).map((finding) => (
                  <li key={finding.id}>
                    <Link href={withContext(`/agency/shops/${finding.shopId}`, host, shop)}>
                      {finding.title}
                    </Link>{' '}
                    - {finding.estimatedSavingsAmount} {finding.currency}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default function AgencyPortalPage() {
  return (
    <Suspense>
      <AgencyPortalPageContent />
    </Suspense>
  );
}
