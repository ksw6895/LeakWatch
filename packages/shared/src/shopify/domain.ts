const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_PATTERN.test(shop);
}

export function normalizeShopDomain(shop: string): string {
  return shop.toLowerCase().trim();
}

export function extractShopDomainFromDest(dest: string): string {
  const parsed = new URL(dest);
  return normalizeShopDomain(parsed.hostname);
}

export function buildAuthorizeUrl(params: {
  shop: string;
  clientId: string;
  scopes: string[];
  redirectUri: string;
  state: string;
}) {
  const search = new URLSearchParams({
    client_id: params.clientId,
    scope: params.scopes.join(','),
    redirect_uri: params.redirectUri,
    state: params.state,
  });

  return `https://${params.shop}/admin/oauth/authorize?${search.toString()}`;
}
