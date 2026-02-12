import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

import {
  createLogger,
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
  NORMALIZE_INVOICE_JOB_NAME,
  RUN_DETECTION_JOB_NAME,
  type IngestDocumentJobPayload,
  type NormalizeInvoiceJobPayload,
  type RunDetectionJobPayload,
} from '@leakwatch/shared';

import { getWorkerEnv } from './env';
import { processRunDetectionJob } from './jobs/detection';
import { processIngestDocumentJob } from './jobs/ingest';
import { processNormalizeInvoiceJob } from './jobs/normalize';

const env = getWorkerEnv();
const logger = createLogger('worker-queue');

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
  connection: redisConnection,
});

export const ingestionWorker = new Worker(
  INGESTION_QUEUE_NAME,
  async (job) => {
    if (job.name === INGEST_DOCUMENT_JOB_NAME) {
      return processIngestDocumentJob(job.data as IngestDocumentJobPayload, ingestionQueue, logger);
    }

    if (job.name === NORMALIZE_INVOICE_JOB_NAME) {
      return processNormalizeInvoiceJob(job.data as NormalizeInvoiceJobPayload, ingestionQueue, logger);
    }

    if (job.name === RUN_DETECTION_JOB_NAME) {
      return processRunDetectionJob(job.data as RunDetectionJobPayload, logger);
    }

    logger.warn({ jobId: job.id, name: job.name }, 'Unknown ingestion job');
    return { skipped: true, reason: 'UNKNOWN_JOB' };
  },
  {
    connection: redisConnection,
  },
);

ingestionWorker.on('failed', (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      name: job?.name,
      error: error.message,
    },
    'Queue job failed',
  );
});

ingestionWorker.on('completed', (job) => {
  logger.info(
    {
      jobId: job.id,
      name: job.name,
    },
    'Queue job completed',
  );
});
