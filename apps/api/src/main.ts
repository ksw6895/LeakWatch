import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { loadEnv } from './config/load-env';
import { getApiEnv } from './config/env';
import { AppModule } from './app.module';

loadEnv();

async function bootstrap() {
  const env = getApiEnv();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  await app.listen(env.PORT);
}

void bootstrap();
