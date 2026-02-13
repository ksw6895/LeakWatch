import { createHmac } from 'node:crypto';

import {
  ActionRequestStatus,
  ActionRunStatus,
  ActionType,
  FindingStatus,
  LeakType,
  OrgRole,
  Plan,
} from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionToken, createTestApp, prisma, resetDatabase } from './helpers';

describe.sequential('Actions flow + Mailgun webhook', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates draft, updates, approves, and enqueues action run', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Org Actions', plan: Plan.STARTER },
    });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'actions-flow.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'actions-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });
    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Potential duplicate charge',
        summary: 'Two matching charges were found.',
        confidence: 88,
        estimatedSavingsAmount: '120',
        currency: 'USD',
      },
    });

    const token = await createSessionToken({
      sub: 'actions-owner',
      shopDomain: shop.shopifyDomain,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/v1/findings/${finding.id}/actions`)
      .set('authorization', `Bearer ${token}`)
      .send({
        type: ActionType.REFUND_REQUEST,
        toEmail: 'finance@example.com',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe('DRAFT');
    const actionRequestId = String(createResponse.body.id);

    const getResponse = await request(app.getHttpServer())
      .get(`/v1/action-requests/${actionRequestId}`)
      .set('authorization', `Bearer ${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(actionRequestId);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/v1/action-requests/${actionRequestId}`)
      .set('authorization', `Bearer ${token}`)
      .send({
        subject: 'Updated subject',
        bodyMarkdown: 'Updated message body',
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.subject).toBe('Updated subject');

    const approveResponse = await request(app.getHttpServer())
      .post(`/v1/action-requests/${actionRequestId}/approve`)
      .set('authorization', `Bearer ${token}`)
      .send({});
    expect(approveResponse.status).toBe(201);
    expect(approveResponse.body.actionRequest.status).toBe('APPROVED');
    expect(approveResponse.body.actionRun.status).toBe('QUEUED');

    const run = await prisma.actionRun.findUnique({
      where: { id: approveResponse.body.actionRun.id as string },
    });
    expect(run?.status).toBe(ActionRunStatus.QUEUED);
  });

  it('rejects mailgun webhook when signature is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/mailgun/webhooks/events')
      .send({
        signature: {
          timestamp: '123',
          token: 'token',
          signature: 'bad-signature',
        },
        'event-data': {
          event: 'delivered',
          timestamp: 123,
        },
      });

    expect(response.status).toBe(401);
  });

  it('updates action run status from mailgun delivered event', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Mailgun' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'mailgun.myshopify.com',
        installedAt: new Date(),
      },
    });
    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.POST_CANCELLATION,
        status: FindingStatus.OPEN,
        title: 'Post cancellation charge',
        summary: 'Charge after cancellation was detected.',
        confidence: 90,
        estimatedSavingsAmount: '50',
        currency: 'USD',
      },
    });
    const actionRequest = await prisma.actionRequest.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        findingId: finding.id,
        type: ActionType.CLARIFICATION,
        status: ActionRequestStatus.APPROVED,
        toEmail: 'finance@example.com',
        ccEmails: [],
        subject: 'Subject',
        bodyMarkdown: 'Body',
      },
    });
    const run = await prisma.actionRun.create({
      data: {
        actionRequestId: actionRequest.id,
        status: ActionRunStatus.SENT,
        mailgunMessageId: '<message-id@example.com>',
      },
    });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'event-token';
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? 'test_mailgun_signing_key';
    const signature = createHmac('sha256', signingKey).update(`${timestamp}${token}`).digest('hex');

    const response = await request(app.getHttpServer())
      .post('/v1/mailgun/webhooks/events')
      .send({
        signature: {
          timestamp,
          token,
          signature,
        },
        'event-data': {
          event: 'delivered',
          timestamp: Number(timestamp),
          message: {
            headers: {
              'message-id': '<message-id@example.com>',
            },
          },
        },
      });

    expect(response.status).toBe(201);

    const updatedRun = await prisma.actionRun.findUnique({ where: { id: run.id } });
    expect(updatedRun?.status).toBe(ActionRunStatus.DELIVERED);

    const events = await prisma.mailEvent.findMany({ where: { actionRunId: run.id } });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.event).toBe('delivered');
  });
});
