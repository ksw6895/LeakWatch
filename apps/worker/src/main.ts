import { createLogger } from '@leakwatch/shared';

import { ingestionWorker, redisConnection } from './queue';

const logger = createLogger('worker');

async function bootstrap() {
  logger.info('LeakWatch worker started');

  const shutdown = async () => {
    await ingestionWorker.close();
    await redisConnection.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });

  process.on('SIGINT', () => {
    void shutdown();
  });
}

void bootstrap();
