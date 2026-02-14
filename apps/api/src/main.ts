import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createLogger } from '@leakwatch/shared';
import type { NextFunction, Request, Response } from 'express';

import { loadEnv } from './config/load-env';
import { getApiEnv } from './config/env';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './filters/http-exception.filter';
import { requestIdMiddleware } from './middleware/request-id.middleware';

loadEnv();

async function bootstrap() {
  const env = getApiEnv();
  const logger = createLogger('api-http');
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix('v1');
  app.use(requestIdMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const requestId =
        typeof res.getHeader('x-request-id') === 'string' ? res.getHeader('x-request-id') : null;
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          latencyMs: Date.now() - startedAt,
        },
        'HTTP request completed',
      );
    });
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter(logger));

  await app.listen(env.PORT);
}

void bootstrap();
