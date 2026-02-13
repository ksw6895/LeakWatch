import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/db';
import { buildLlmCacheKey, getLlmCache, setLlmCache } from '../src/normalization/cache';

describe.sequential('llm cache', () => {
  beforeEach(async () => {
    await prisma.llmCache.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores and retrieves cached value', async () => {
    const cacheKey = buildLlmCacheKey({
      model: 'gpt-4o-mini',
      payload: 'hello',
    });

    await setLlmCache(prisma, {
      cacheKey,
      model: 'gpt-4o-mini',
      valueJson: {
        invoiceNumber: 'INV-1',
      },
    });

    const cached = await getLlmCache(prisma, cacheKey);
    expect(cached).not.toBeNull();
    expect(cached?.invoiceNumber).toBe('INV-1');
  });
});
