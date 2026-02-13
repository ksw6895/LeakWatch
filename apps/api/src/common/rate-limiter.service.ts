import { Injectable } from '@nestjs/common';

type Counter = {
  count: number;
  windowStart: number;
};

@Injectable()
export class RateLimiterService {
  private readonly counters = new Map<string, Counter>();

  consume(key: string, limit: number, windowSec: number) {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const existing = this.counters.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      this.counters.set(key, {
        count: 1,
        windowStart: now,
      });
      return {
        allowed: true,
        remaining: limit - 1,
      };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
    };
  }
}
