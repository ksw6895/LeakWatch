import { INGEST_DOCUMENT_JOB_NAME, INGESTION_QUEUE_NAME } from '@leakwatch/shared';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { getApiEnv } from '../../config/env';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly env = getApiEnv();
  private readonly connection = new IORedis(this.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  private readonly queue = new Queue(INGESTION_QUEUE_NAME, {
    connection: this.connection,
  });

  async enqueueIngest(documentVersionId: string) {
    const job = await this.queue.add(
      INGEST_DOCUMENT_JOB_NAME,
      {
        documentVersionId,
      },
      {
        jobId: `${INGEST_DOCUMENT_JOB_NAME}-${documentVersionId}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    return String(job.id);
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
