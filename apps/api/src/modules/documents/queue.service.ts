import {
  GENERATE_EVIDENCE_PACK_JOB_NAME,
  INGEST_DOCUMENT_JOB_NAME,
  INGESTION_QUEUE_NAME,
  REPORT_GENERATE_JOB_NAME,
  SEND_EMAIL_JOB_NAME,
  type ReportGenerateJobPayload,
} from '@leakwatch/shared';
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

  async enqueueEvidencePack(actionRequestId: string) {
    const job = await this.queue.add(
      GENERATE_EVIDENCE_PACK_JOB_NAME,
      {
        actionRequestId,
      },
      {
        jobId: `${GENERATE_EVIDENCE_PACK_JOB_NAME}-${actionRequestId}`,
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

  async enqueueSendEmail(actionRunId: string) {
    const job = await this.queue.add(
      SEND_EMAIL_JOB_NAME,
      {
        actionRunId,
      },
      {
        jobId: `${SEND_EMAIL_JOB_NAME}-${actionRunId}`,
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

  async enqueueReportGenerate(payload: ReportGenerateJobPayload) {
    const job = await this.queue.add(REPORT_GENERATE_JOB_NAME, payload, {
      jobId: `${REPORT_GENERATE_JOB_NAME}-${payload.period}-${payload.shopId}-${Date.now()}`,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return String(job.id);
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}
