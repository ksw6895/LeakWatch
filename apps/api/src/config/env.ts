import { parseEnv } from '@leakwatch/shared';
import { z } from 'zod';

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().default('read_products'),
  SHOPIFY_APP_URL: z.string().url(),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  LW_ENCRYPTION_KEY_32B: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'LW_ENCRYPTION_KEY_32B must decode to 32 bytes'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

let cachedEnv: ApiEnv | null = null;

export function getApiEnv(): ApiEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(apiEnvSchema, process.env);
  }
  return cachedEnv;
}

export function clearApiEnvCache() {
  cachedEnv = null;
}
