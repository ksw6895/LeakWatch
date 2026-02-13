import { Suspense } from 'react';

import { EmbeddedLayoutClient } from './embedded-layout-client';

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="lw-embedded-layout">{children}</div>}>
      <EmbeddedLayoutClient>{children}</EmbeddedLayoutClient>
    </Suspense>
  );
}
