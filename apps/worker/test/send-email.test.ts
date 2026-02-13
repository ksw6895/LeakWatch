import { ActionRunStatus, ActionType, FindingStatus, LeakType } from '@prisma/client';
import { createLogger, type SendEmailJobPayload } from '@leakwatch/shared';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../src/db';
import { processSendEmailJob } from '../src/jobs/send-email';

const logger = createLogger('worker-send-email-test');

async function resetDatabase() {
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

describe.sequential('processSendEmailJob', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sends approved action email and marks action run as SENT', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ id: 'abc123@mg.example.com' }),
      } satisfies Partial<Response> as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const org = await prisma.organization.create({ data: { name: 'Org Action' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'actions.myshopify.com',
        installedAt: new Date(),
      },
    });
    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.MOM_SPIKE,
        status: FindingStatus.OPEN,
        title: 'Need clarification',
        summary: 'Please clarify invoice lines',
        confidence: 80,
        estimatedSavingsAmount: '12',
        currency: 'USD',
      },
    });

    const request = await prisma.actionRequest.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        findingId: finding.id,
        type: ActionType.CLARIFICATION,
        toEmail: 'finance@example.com',
        ccEmails: ['ops@example.com'],
        subject: 'Clarification request',
        bodyMarkdown: 'Please review and clarify this invoice charge.',
      },
    });

    const run = await prisma.actionRun.create({
      data: {
        actionRequestId: request.id,
        status: ActionRunStatus.QUEUED,
      },
    });

    const payload: SendEmailJobPayload = {
      actionRunId: run.id,
    };

    const result = await processSendEmailJob(payload, logger);
    expect(result.ok).toBe(true);

    const updated = await prisma.actionRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe(ActionRunStatus.SENT);
    expect(updated?.mailgunMessageId).toBe('<abc123@mg.example.com>');

    vi.unstubAllGlobals();
  });
});
