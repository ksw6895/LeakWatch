import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import { createLogger } from '@leakwatch/shared';

const logger = createLogger('worker-queue');

export const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const ingestionQueue = new Queue('ingestion', {
  connection: redisConnection,
});

export const ingestionWorker = new Worker(
  'ingestion',
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processing ingestion job');
    return { ok: true };
  },
  {
    connection: redisConnection,
  },
);
