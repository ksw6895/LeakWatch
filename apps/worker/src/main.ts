import { createLogger } from '@leakwatch/shared';
import { REPORT_GENERATE_JOB_NAME, type ReportGenerateJobPayload } from '@leakwatch/shared';
import { ReportPeriod } from '@prisma/client';

import { prisma } from './db';
import { loadEnv } from './load-env';
import { ingestionQueue, ingestionWorker, redisConnection } from './queue';

loadEnv();

const logger = createLogger('worker');

async function registerReportSchedules() {
  const shops = await prisma.shop.findMany({
    where: {
      uninstalledAt: null,
    },
    select: {
      id: true,
      timezone: true,
    },
  });

  await Promise.all(
    shops.flatMap((shop) => {
      const weeklyPayload: ReportGenerateJobPayload = {
        shopId: shop.id,
        period: ReportPeriod.WEEKLY,
        trigger: 'weekly',
      };

      const monthlyPayload: ReportGenerateJobPayload = {
        shopId: shop.id,
        period: ReportPeriod.MONTHLY,
        trigger: 'monthly',
      };

      return [
        ingestionQueue.add(REPORT_GENERATE_JOB_NAME, weeklyPayload, {
          jobId: `${REPORT_GENERATE_JOB_NAME}-weekly-${shop.id}`,
          repeat: {
            pattern: '0 9 * * 1',
            tz: shop.timezone,
          },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }),
        ingestionQueue.add(REPORT_GENERATE_JOB_NAME, monthlyPayload, {
          jobId: `${REPORT_GENERATE_JOB_NAME}-monthly-${shop.id}`,
          repeat: {
            pattern: '0 10 1 * *',
            tz: shop.timezone,
          },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }),
      ];
    }),
  );
}

async function bootstrap() {
  await registerReportSchedules();
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
