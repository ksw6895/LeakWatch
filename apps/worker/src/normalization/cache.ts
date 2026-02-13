import { createHash } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';

const DEFAULT_PROMPT_VERSION = 'normalize-v1';
const TTL_DAYS = 30;

export function buildLlmCacheKey(input: {
  model: string;
  promptVersion?: string;
  payload: string;
}) {
  return createHash('sha256')
    .update(`${input.model}:${input.promptVersion ?? DEFAULT_PROMPT_VERSION}:${input.payload}`)
    .digest('hex');
}

export async function getLlmCache(prisma: PrismaClient, cacheKey: string) {
  const row = await prisma.llmCache.findUnique({ where: { cacheKey } });
  if (!row) {
    return null;
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.llmCache.delete({ where: { id: row.id } });
    return null;
  }
  return row.valueJson as Record<string, unknown>;
}

export async function setLlmCache(
  prisma: PrismaClient,
  args: {
    cacheKey: string;
    model: string;
    promptVersion?: string;
    valueJson: Record<string, unknown>;
  },
) {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.llmCache.upsert({
    where: { cacheKey: args.cacheKey },
    create: {
      cacheKey: args.cacheKey,
      model: args.model,
      promptVer: args.promptVersion ?? DEFAULT_PROMPT_VERSION,
      valueJson: args.valueJson as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      valueJson: args.valueJson as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}
