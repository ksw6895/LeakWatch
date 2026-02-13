import { describe, expect, it } from 'vitest';

import { RateLimiterService } from '../src/common/rate-limiter.service';

describe('RateLimiterService', () => {
  it('blocks when limit is exceeded within window', () => {
    const limiter = new RateLimiterService();
    expect(limiter.consume('k', 2, 60).allowed).toBe(true);
    expect(limiter.consume('k', 2, 60).allowed).toBe(true);
    expect(limiter.consume('k', 2, 60).allowed).toBe(false);
  });
});
