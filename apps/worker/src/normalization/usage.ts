import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function incrementUsageCounter(
  prisma: DbClient,
  args: {
    orgId: string;
    shopId: string;
    metric: string;
    delta: number;
  },
) {
  if (args.delta <= 0) {
    return;
  }

  const day = startOfUtcDay(new Date());
  await prisma.usageCounter.upsert({
    where: {
      orgId_shopId_day_metric: {
        orgId: args.orgId,
        shopId: args.shopId,
        day,
        metric: args.metric,
      },
    },
    create: {
      orgId: args.orgId,
      shopId: args.shopId,
      day,
      metric: args.metric,
      value: BigInt(args.delta),
    },
    update: {
      value: {
        increment: BigInt(args.delta),
      },
    },
  });
}

export async function incrementOpenAiUsage(
  prisma: DbClient,
  args: {
    orgId: string;
    shopId: string;
    inputTokens: number;
    outputTokens: number;
  },
) {
  await incrementUsageCounter(prisma, {
    orgId: args.orgId,
    shopId: args.shopId,
    metric: 'openai_tokens_in',
    delta: args.inputTokens,
  });

  await incrementUsageCounter(prisma, {
    orgId: args.orgId,
    shopId: args.shopId,
    metric: 'openai_tokens_out',
    delta: args.outputTokens,
  });
}

