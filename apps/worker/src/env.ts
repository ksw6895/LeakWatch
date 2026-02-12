import { parseEnv } from '@leakwatch/shared';
import { z } from 'zod';

import { loadEnv } from './load-env';

loadEnv();

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_REGION: z.string().default('auto'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL_NORMALIZE: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_VISION: z.string().default('gpt-4o-mini'),
  OPENAI_MODEL_EMAIL_DRAFT: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(1).max(5).default(3),
  MAILGUN_API_KEY: z.string().min(1).optional(),
  MAILGUN_DOMAIN: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

let cachedEnv: WorkerEnv | null = null;

export function getWorkerEnv(): WorkerEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(workerEnvSchema, process.env);
  }
  return cachedEnv;
}

export function clearWorkerEnvCache() {
  cachedEnv = null;
}
