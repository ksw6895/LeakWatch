import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import HomePage from '../app/page';

describe('HomePage redirect', () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it('redirects to /app without query params', () => {
    HomePage({});
    expect(redirectMock).toHaveBeenCalledWith('/app');
  });

  it('preserves incoming query params when redirecting to /app', () => {
    HomePage({
      searchParams: {
        host: 'c2hvcC1leGFtcGxlLm15c2hvcGlmeS5jb20vYWRtaW4',
        shop: 'shop-example.myshopify.com',
      },
    });

    expect(redirectMock).toHaveBeenCalledWith(
      '/app?host=c2hvcC1leGFtcGxlLm15c2hvcGlmeS5jb20vYWRtaW4&shop=shop-example.myshopify.com',
    );
  });
});
