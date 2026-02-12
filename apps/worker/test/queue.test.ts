import { afterAll, describe, expect, it } from 'vitest';

import { ingestionQueue, ingestionWorker, redisConnection } from '../src/queue';
import { prisma } from '../src/db';

describe('worker queue', () => {
  it('creates ingestion queue with name', () => {
    expect(ingestionQueue.name).toBe('ingestion');
  });

  afterAll(async () => {
    await ingestionWorker.close();
    await ingestionQueue.close();
    await prisma.$disconnect();
    await redisConnection.quit();
  });
});
