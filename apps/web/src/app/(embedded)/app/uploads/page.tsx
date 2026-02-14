'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { UploadsPanel } from '../../../../components/uploads-panel';

function UploadsPageContent() {
  const params = useSearchParams();
  const host = params.get('host');
  const shop = params.get('shop');

  return <UploadsPanel host={host} shop={shop} />;
}

export default function UploadsPage() {
  return (
    <Suspense>
      <UploadsPageContent />
    </Suspense>
  );
}
