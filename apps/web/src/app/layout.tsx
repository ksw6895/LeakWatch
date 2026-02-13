import './globals.css';

import type { Metadata } from 'next';
import { Public_Sans, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

const bodyFont = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lw-font-body',
});

const displayFont = Space_Grotesk({
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
