'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { StatePanel } from '../../../components/common/StatePanel';

type NavItem = {
  href: string;
  label: string;
  glyph: 'dashboard' | 'uploads' | 'leaks' | 'actions' | 'reports' | 'settings' | 'agency';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Dashboard', glyph: 'dashboard' },
  { href: '/app/uploads', label: 'Uploads', glyph: 'uploads' },
  { href: '/app/leaks', label: 'Leaks', glyph: 'leaks' },
  { href: '/app/actions', label: 'Actions', glyph: 'actions' },
  { href: '/app/reports', label: 'Reports', glyph: 'reports' },
  { href: '/app/settings', label: 'Settings', glyph: 'settings' },
  { href: '/app/agency', label: 'Agency', glyph: 'agency' },
];

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 17.5a1.8 1.8 0 0 0 1.74-1.25M5.7 8.4c0-2.45 1.98-4.43 4.42-4.43 2.44 0 4.42 1.98 4.42 4.43v2.23l1.1 1.86c.21.35-.04.8-.45.8H4.6c-.41 0-.66-.45-.45-.8l1.1-1.86V8.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m6.25 7.5 3.75 4.17 3.75-4.17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function NavGlyph({ kind }: { kind: NavItem['glyph'] }) {
  if (kind === 'dashboard') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M3.8 3.8h5.4v5.4H3.8V3.8Zm7 0h5.4v3.7h-5.4V3.8Zm0 5.4h5.4v7h-5.4v-7Zm-7 1.7h5.4v5.3H3.8V10.9Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'uploads') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3.8v8.1m0-8.1L7.2 6.6M10 3.8l2.8 2.8M4.4 12.9v1.9a1 1 0 0 0 1 1h9.2a1 1 0 0 0 1-1v-1.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === 'leaks') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3.6c3 2.8 4.5 5 4.5 7.1A4.5 4.5 0 1 1 5.5 10.7c0-2 1.5-4.3 4.5-7.1Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === 'actions') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m4 10 3.4 3.4L16 4.8m-12 5.6 3.4 3.4L16 5.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === 'reports') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4.2 4.2h11.6v11.6H4.2V4.2Zm2.1 7h1.7V13H6.3v-1.8Zm3 0H11V13H9.3v-1.8Zm3 0H14V13h-1.7v-1.8Zm-6-3H14V9.9H6.3V8.2Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 6.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Zm6 3.3-.9.4c-.1.4-.2.8-.4 1.1l.5.8-1.2 1.2-.8-.5c-.3.2-.7.3-1.1.4l-.4.9H9.3l-.4-.9c-.4 0-.8-.2-1.1-.4l-.8.5-1.2-1.2.5-.8c-.2-.3-.3-.7-.4-1.1l-.9-.4V8.3l.9-.4c.1-.4.2-.8.4-1.1l-.5-.8L7 4.8l.8.5c.3-.2.7-.3 1.1-.4l.4-.9h1.4l.4.9c.4.1.8.2 1.1.4l.8-.5 1.2 1.2-.5.8c.2.3.3.7.4 1.1l.9.4V10Z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.7 6.2a3.1 3.1 0 1 1 6.2 0 3.1 3.1 0 0 1-6.2 0Zm-2.8 8.1a6.1 6.1 0 0 1 12.2 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

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

function isActivePath(currentPath: string, navPath: string): boolean {
  if (navPath === '/app') {
    return currentPath === '/app';
  }

  return currentPath === navPath || currentPath.startsWith(`${navPath}/`);
}

export function EmbeddedLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');

  return (
    <div className="lw-embedded-layout">
      <header className="lw-embedded-header">
        <div className="lw-embedded-brand">
          <span className="lw-embedded-brand-mark" aria-hidden="true">
            LW
          </span>
          <div className="lw-embedded-brand-copy">
            <span className="lw-embedded-brand-title">LeakWatch</span>
            <span className="lw-embedded-brand-meta">Subscription intelligence</span>
          </div>
        </div>

        <nav className="lw-embedded-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const target = withContext(item.href, host, shop);
            const isActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={target}
                className={`lw-embedded-nav-link${isActive ? ' lw-embedded-nav-link--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="lw-embedded-nav-glyph" aria-hidden="true">
                  <NavGlyph kind={item.glyph} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="lw-embedded-toolbar">
          <div className="lw-embedded-context" role="status" aria-live="polite">
            <span
              className={`lw-inline-chip lw-inline-chip--context${shop ? '' : ' lw-inline-chip--alert'}`}
            >
              shop: {shop ?? 'missing'}
            </span>
            <span
              className={`lw-inline-chip lw-inline-chip--context${host ? '' : ' lw-inline-chip--alert'}`}
            >
              host: {host ? 'connected' : 'missing'}
            </span>
          </div>
          <div className="lw-embedded-user">
            <button type="button" className="lw-embedded-icon-btn" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="lw-embedded-account-btn" aria-label="Account menu">
              <span className="lw-embedded-avatar" aria-hidden="true">
                LW
              </span>
              <ChevronDownIcon />
            </button>
          </div>
        </div>
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

      <main className="lw-embedded-content">{children}</main>
    </div>
  );
}
