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
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Agency Portal</h1>
      <p>Cross-shop operations workspace with tenant-scoped summary and direct drill-down links.</p>
      {!host ? (
        <p>
          Missing <code>host</code> parameter. Open from Shopify Admin to restore embedded context.
        </p>
      ) : null}
      {error ? <p>{error}</p> : null}

      {summary ? (
        <section>
          <h2>Organization Summary</h2>
          <p>Shops: {summary.shopsCount}</p>
          <p>Total spend: {summary.totalSpend}</p>
          <p>Potential savings: {summary.potentialSavings}</p>
        </section>
      ) : null}

      <section>
        <h2>Operational Links</h2>
        <ul>
          <li>
            <Link href={withContext('/agency/reports', host, shop)}>Agency reports</Link>
          </li>
          <li>
            <Link href={withContext('/app/agency', host, shop)}>Embedded agency dashboard</Link>
          </li>
          {summary?.topFindingsAcrossShops.slice(0, 5).map((finding) => (
            <li key={finding.id}>
              <Link href={withContext(`/agency/shops/${finding.shopId}`, host, shop)}>
                {finding.title}
              </Link>{' '}
              - {finding.estimatedSavingsAmount} {finding.currency}
            </li>
          ))}
        </ul>
      </section>
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
