import './globals.css';

import type { Metadata } from 'next';
import { Arimo } from 'next/font/google';
import type { ReactNode } from 'react';

const bodyFont = Arimo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lw-font-body',
});

const displayFont = Arimo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lw-font-display',
});

export const metadata: Metadata = {
  title: 'LeakWatch',
  description: 'Leak detection for Shopify invoices',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
