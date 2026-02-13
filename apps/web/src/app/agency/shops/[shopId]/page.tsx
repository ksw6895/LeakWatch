type AgencyShopDetailPageProps = {
  params: {
    shopId: string;
  };
};

export default function AgencyShopDetailPage({ params }: AgencyShopDetailPageProps) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Agency Shop Detail</h1>
      <p>Shop: {params.shopId}</p>
      <p>Write actions are disabled on this route until role and host context are verified.</p>
    </main>
  );
}
