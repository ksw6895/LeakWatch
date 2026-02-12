import { createLogger } from '@leakwatch/shared';

import { loadEnv } from './load-env';
import { ingestionWorker, redisConnection } from './queue';

loadEnv();

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
