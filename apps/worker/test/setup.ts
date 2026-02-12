process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.R2_ENDPOINT = process.env.R2_ENDPOINT ?? 'https://example.r2.cloudflarestorage.com';
process.env.R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'test_r2_key';
process.env.R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? 'test_r2_secret';
process.env.R2_BUCKET = process.env.R2_BUCKET ?? 'leakwatch-test';
process.env.R2_REGION = process.env.R2_REGION ?? 'auto';
process.env.OPENAI_MODEL_NORMALIZE = process.env.OPENAI_MODEL_NORMALIZE ?? 'gpt-4o-mini';
process.env.OPENAI_MODEL_VISION = process.env.OPENAI_MODEL_VISION ?? 'gpt-4o-mini';
process.env.OPENAI_MODEL_EMAIL_DRAFT = process.env.OPENAI_MODEL_EMAIL_DRAFT ?? 'gpt-4o-mini';
process.env.OPENAI_MAX_RETRIES = process.env.OPENAI_MAX_RETRIES ?? '1';
