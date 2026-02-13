'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { StatePanel } from '../../../components/common/StatePanel';

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/uploads', label: 'Uploads' },
  { href: '/app/leaks', label: 'Leaks' },
  { href: '/app/actions', label: 'Actions' },
  { href: '/app/reports', label: 'Reports' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/agency', label: 'Agency' },
];

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

export function EmbeddedLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');

  return (
    <div className="lw-embedded-layout">
      <header className="lw-embedded-header">
        <nav className="lw-embedded-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const target = withContext(item.href, host, shop);
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={target}
                className={`lw-embedded-nav-link${isActive ? ' lw-embedded-nav-link--active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!host ? (
        <div className="lw-embedded-recover">
          <StatePanel
            kind="error"
            title="Session parameters are missing"
            message="Open LeakWatch from Shopify Admin to restore embedded host/session context."
          />
        </div>
      ) : null}

      {children}
    </div>
  );
}
