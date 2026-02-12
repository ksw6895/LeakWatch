import type { RunDetectionJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

export async function processRunDetectionJob(payload: RunDetectionJobPayload, logger: pino.Logger) {
  logger.info(
    {
      documentVersionId: payload.documentVersionId,
      shopId: payload.shopId,
    },
    'RUN_DETECTION enqueued (step-06 engine not implemented yet)',
  );

  return {
    queued: true,
    step: '06',
  };
}

