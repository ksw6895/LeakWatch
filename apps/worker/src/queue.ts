import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import {
  createLogger,
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
} from '@leakwatch/shared';

const logger = createLogger('worker-queue');

export const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection: redisConnection,
});

export const ingestionWorker = new Worker(
  INGESTION_QUEUE_NAME,
  async (job) => {
    if (job.name !== INGEST_DOCUMENT_JOB_NAME) {
      logger.warn({ jobId: job.id, name: job.name }, 'Unknown ingestion job');
      return { skipped: true };
    }

    logger.info(
      { jobId: job.id, name: job.name, payload: job.data },
      'Processing ingestion document job',
    );
    return { ok: true };
  },
  {
    connection: redisConnection,
  },
);
