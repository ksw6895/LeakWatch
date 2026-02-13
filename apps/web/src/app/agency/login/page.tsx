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
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Agency Workspace Login</h1>
      <p>
        Open this page from Shopify Admin so embedded session context is available. Access is
        enforced server-side with tenant and role guards.
      </p>
      {!host ? (
        <p>
          Missing <code>host</code> parameter. Re-open from Shopify Admin Apps.
        </p>
      ) : (
        <p>
          Session context detected. Continue to{' '}
          <Link href={withContext('/agency/reports', host, shop)}>agency reports</Link> or{' '}
          <Link href={withContext('/app/agency', host, shop)}>embedded agency dashboard</Link>.
        </p>
      )}
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
