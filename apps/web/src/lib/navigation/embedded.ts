type EmbeddedContext = {
  host?: string | null;
  shop?: string | null;
};

export function buildEmbeddedUrl(path: string, context: EmbeddedContext): string {
  const next = new URL(path, window.location.origin);
  if (context.host) {
    next.searchParams.set('host', context.host);
  }
  if (context.shop) {
    next.searchParams.set('shop', context.shop);
  }
  return next.toString();
}

export function navigateEmbedded(path: string, context: EmbeddedContext): void {
  window.location.assign(buildEmbeddedUrl(path, context));
}
