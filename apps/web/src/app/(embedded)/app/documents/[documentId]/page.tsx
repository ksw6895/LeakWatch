'use client';

import { useParams, useSearchParams } from 'next/navigation';

import { StatePanel } from '../../../../../components/common/StatePanel';

function buildBackTarget(host: string | null, shop: string | null): string {
  const params = new URLSearchParams();
  if (host) {
    params.set('host', host);
  }
  if (shop) {
    params.set('shop', shop);
  }
  const query = params.toString();
  return query ? `/app/uploads?${query}` : '/app/uploads';
}

export default function DocumentDetailPage() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const host = searchParams.get('host');
  const shop = searchParams.get('shop');

  return (
    <div style={{ padding: 16 }}>
      <StatePanel
        kind="empty"
        title="Document detail is being prepared"
        message={`Document ${params.documentId} detail view is not available yet. Use uploads list and status indicators for now.`}
        actionLabel="Back to uploads"
        onAction={() => {
          window.location.assign(buildBackTarget(host, shop));
        }}
      />
    </div>
  );
}
