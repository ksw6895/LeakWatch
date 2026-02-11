import { FindingStatus, LeakType, OrgRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-001' },
    update: { name: 'LeakWatch Seed Org' },
    create: {
      id: 'seed-org-001',
      name: 'LeakWatch Seed Org',
    },
  });

  const user = await prisma.user.upsert({
    where: { shopifyUserId: 'seed-owner' },
    update: { displayName: 'Seed Owner' },
    create: {
      shopifyUserId: 'seed-owner',
      displayName: 'Seed Owner',
    },
  });

  await prisma.membership.upsert({
    where: {
      orgId_userId: {
        orgId: org.id,
        userId: user.id,
      },
    },
    update: { role: OrgRole.OWNER },
    create: {
      orgId: org.id,
      userId: user.id,
      role: OrgRole.OWNER,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: 'seed-store.myshopify.com' },
    update: {
      orgId: org.id,
      installedAt: new Date(),
      uninstalledAt: null,
    },
    create: {
      orgId: org.id,
      shopifyDomain: 'seed-store.myshopify.com',
      displayName: 'Seed Store',
      installedAt: new Date(),
    },
  });

  const existingFinding = await prisma.leakFinding.findFirst({
    where: {
      orgId: org.id,
      shopId: shop.id,
      title: 'Seed duplicate charge',
    },
  });

  if (!existingFinding) {
    await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Seed duplicate charge',
        summary: 'Seed finding for local smoke tests',
        confidence: 80,
        estimatedSavingsAmount: '42',
        currency: 'USD',
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed:', { orgId: org.id, shopId: shop.id, userId: user.id });
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
