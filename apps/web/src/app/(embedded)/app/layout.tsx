import { Suspense } from 'react';

import { EmbeddedProviders } from './embedded-providers';
import { EmbeddedLayoutClient } from './embedded-layout-client';

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="lw-embedded-layout">{children}</div>}>
      <EmbeddedProviders>
        <EmbeddedLayoutClient>{children}</EmbeddedLayoutClient>
      </EmbeddedProviders>
    </Suspense>
  );
}
