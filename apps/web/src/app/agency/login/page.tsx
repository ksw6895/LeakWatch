'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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

function AgencyLoginPageContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');

  return (
    <main className="lw-standalone-main">
      <div className="lw-standalone-stack">
        <section className="lw-standalone-card">
          <span className="lw-eyebrow">Agency Access</span>
          <div className="lw-title">
            <h1>Agency Workspace Login</h1>
          </div>
          <p className="lw-standalone-note">
            Open this page from Shopify Admin so embedded session context is available. Access is
            enforced server-side with tenant and role guards.
          </p>

          {!host ? (
            <p className="lw-standalone-alert">
              Missing <code>host</code> parameter. Re-open from Shopify Admin Apps.
            </p>
          ) : (
            <div className="lw-standalone-links">
              <Link href={withContext('/agency/reports', host, shop)}>Agency reports</Link>
              <Link href={withContext('/app/agency', host, shop)}>Embedded agency dashboard</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function AgencyLoginPage() {
  return (
    <Suspense>
      <AgencyLoginPageContent />
    </Suspense>
  );
}
