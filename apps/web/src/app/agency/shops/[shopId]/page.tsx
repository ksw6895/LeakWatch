'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { apiFetch } from '../../../../lib/api/fetcher';

type AgencyShopDetailPageProps = {
  params: {
    shopId: string;
  };
};

type AuthMe = {
  roles: string[];
};

type ShopSummary = {
  thisMonthSpend: string;
  potentialSavings: string;
  openActions: number;
  currency: string;
};

type Finding = {
  id: string;
  title: string;
  status: string;
  estimatedSavingsAmount: string;
  currency: string;
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

function AgencyShopDetailPageContent({ params }: AgencyShopDetailPageProps) {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');
  const [summary, setSummary] = useState<ShopSummary | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
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
            'Agency shop access requires OWNER, MEMBER, AGENCY_ADMIN, or AGENCY_VIEWER role.',
          );
        }

        const [summaryResponse, findingsResponse] = await Promise.all([
          apiFetch(`/v1/shops/${params.shopId}/summary`, { host }),
          apiFetch(`/v1/shops/${params.shopId}/findings`, { host }),
        ]);
        if (!summaryResponse.ok) {
          throw new Error(`Summary fetch failed (${summaryResponse.status})`);
        }
        if (!findingsResponse.ok) {
          throw new Error(`Findings fetch failed (${findingsResponse.status})`);
        }

        setSummary((await summaryResponse.json()) as ShopSummary);
        setFindings((await findingsResponse.json()) as Finding[]);
        setError(null);
      } catch (unknownError) {
        setError(unknownError instanceof Error ? unknownError.message : 'Unknown error');
      }
    })();
  }, [host, params.shopId]);

  return (
    <main className="lw-standalone-main">
      <div className="lw-standalone-stack">
        <section className="lw-standalone-card">
          <span className="lw-eyebrow">Shop Workspace</span>
          <div className="lw-title">
            <h1>Agency shop details</h1>
          </div>
          <p className="lw-standalone-note">
            Shop ID: <code>{params.shopId}</code>
          </p>
          {!host ? (
            <p className="lw-standalone-alert">
              Missing host parameter. Re-open from Shopify Admin.
            </p>
          ) : null}
          {error ? <p className="lw-standalone-alert">{error}</p> : null}

          {summary ? (
            <div className="lw-summary-grid">
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Spend</div>
                <div className="lw-metric-value">
                  {summary.thisMonthSpend} {summary.currency}
                </div>
              </div>
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Potential savings</div>
                <div className="lw-metric-value">
                  {summary.potentialSavings} {summary.currency}
                </div>
              </div>
              <div className="lw-metric lw-metric--compact">
                <div className="lw-metric-label">Open actions</div>
                <div className="lw-metric-value">{summary.openActions}</div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="lw-standalone-card">
          <div className="lw-title">
            <h2>Top findings</h2>
          </div>
          {findings.length === 0 ? (
            <p className="lw-standalone-note">No findings for this shop.</p>
          ) : (
            <ul className="lw-standalone-list">
              {findings.slice(0, 10).map((finding) => (
                <li key={finding.id}>
                  <Link href={withContext(`/app/leaks/${finding.id}`, host, shop)}>
                    {finding.title}
                  </Link>{' '}
                  - {finding.status} - {finding.estimatedSavingsAmount} {finding.currency}
                </li>
              ))}
            </ul>
          )}

          <div className="lw-standalone-links">
            <Link href={withContext('/agency/reports', host, shop)}>Back to agency reports</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AgencyShopDetailPage({ params }: AgencyShopDetailPageProps) {
  return (
    <Suspense>
      <AgencyShopDetailPageContent params={params} />
    </Suspense>
  );
}
