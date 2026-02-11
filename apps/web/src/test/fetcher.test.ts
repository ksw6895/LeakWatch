import { describe, expect, it } from 'vitest';

import { apiFetch } from '../lib/api/fetcher';

describe('apiFetch', () => {
  it('builds request url', async () => {
    const originalFetch = globalThis.fetch;
    let calledUrl = '';

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await apiFetch('/v1/health');
    expect(calledUrl.includes('/v1/health')).toBe(true);

    globalThis.fetch = originalFetch;
  });
});
