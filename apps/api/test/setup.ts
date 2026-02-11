import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '4000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://leakwatch:leakwatch@localhost:5433/leakwatch?schema=public';
process.env.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY ?? 'test_key';
process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? 'test_secret';
process.env.SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES ?? 'read_products';
process.env.SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL ?? 'http://localhost:3000';
process.env.API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
process.env.LW_ENCRYPTION_KEY_32B =
  process.env.LW_ENCRYPTION_KEY_32B ?? 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
