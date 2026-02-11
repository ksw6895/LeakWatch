import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

import { AppModule } from '../src/app.module';

export const prisma = new PrismaClient();

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('v1');
  await app.init();
  return app;
}

export async function resetDatabase() {
  await prisma.mailEvent.deleteMany();
  await prisma.actionRun.deleteMany();
  await prisma.actionRequest.deleteMany();
  await prisma.evidenceRef.deleteMany();
  await prisma.leakFinding.deleteMany();
  await prisma.vendorOnShop.deleteMany();
  await prisma.normalizedLineItem.deleteMany();
  await prisma.normalizedInvoice.deleteMany();
  await prisma.extractedArtifact.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.shopifyToken.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.vendor.deleteMany();
}

export async function createSessionToken(params: {
  sub: string;
  shopDomain: string;
  apiKey?: string;
  secret?: string;
}) {
  const apiKey = params.apiKey ?? process.env.SHOPIFY_API_KEY ?? 'test_key';
  const secret = params.secret ?? process.env.SHOPIFY_API_SECRET ?? 'test_secret';

  return new SignJWT({
    dest: `https://${params.shopDomain}/admin`,
    aud: apiKey,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(params.sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience(apiKey)
    .setIssuer('shopify')
    .sign(new TextEncoder().encode(secret));
}
