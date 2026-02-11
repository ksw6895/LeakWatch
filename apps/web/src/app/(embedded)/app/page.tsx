import { Suspense } from 'react';

import { EmbeddedShell } from '../../../components/embedded-shell';

export default function EmbeddedAppPage() {
  return (
    <Suspense>
      <EmbeddedShell />
    </Suspense>
  );
}
