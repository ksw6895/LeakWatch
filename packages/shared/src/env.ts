import { z } from 'zod';

export function parseEnv<T extends z.ZodRawShape>(schema: z.ZodObject<T>, input = process.env) {
  return schema.parse(input);
}
