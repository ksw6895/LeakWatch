import { createLogger } from '@leakwatch/shared';

import { prisma } from './db';
import { loadEnv } from './load-env';
import { ingestionQueue, ingestionWorker, redisConnection } from './queue';

loadEnv();

const logger = createLogger('worker');

async function bootstrap() {
  logger.info('LeakWatch worker started');

  const shutdown = async () => {
    await ingestionQueue.close();
    await ingestionWorker.close();
    await prisma.$disconnect();
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
