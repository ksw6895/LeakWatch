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

  it('updates action status manually to waiting reply and resolved', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Manual Status' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'manual-status.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'manual-owner' } });
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
        title: 'Manual status finding',
        summary: 'Manual status transitions',
        confidence: 80,
        estimatedSavingsAmount: '20',
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
        toEmail: 'ops@example.com',
        ccEmails: [],
        subject: 'Manual status',
        bodyMarkdown: 'Body',
        createdByUserId: user.id,
        approvedByUserId: user.id,
      },
    });
    await prisma.actionRun.create({
      data: {
        actionRequestId: actionRequest.id,
        status: ActionRunStatus.SENT,
      },
    });

    const token = await createSessionToken({
      sub: 'manual-owner',
      shopDomain: shop.shopifyDomain,
    });

    const waitingReply = await request(app.getHttpServer())
      .post(`/v1/action-requests/${actionRequest.id}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'WAITING_REPLY' });
    expect(waitingReply.status).toBe(201);
    expect(waitingReply.body.displayStatus).toBe('WAITING_REPLY');
    expect(waitingReply.body.latestRunStatus).toBe('DELIVERED');

    const resolved = await request(app.getHttpServer())
      .post(`/v1/action-requests/${actionRequest.id}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });
    expect(resolved.status).toBe(201);
    expect(resolved.body.displayStatus).toBe('RESOLVED');
    expect(resolved.body.latestRunStatus).toBe('RESOLVED');

    const latestRun = await prisma.actionRun.findFirst({
      where: {
        actionRequestId: actionRequest.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(latestRun?.status).toBe(ActionRunStatus.RESOLVED);
  });

  it('marks action as resolved from inbound mailgun reply parse webhook', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Inbound Reply' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'inbound-reply.myshopify.com',
        installedAt: new Date(),
      },
    });
    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Inbound reply finding',
        summary: 'Need inbound reply parse',
        confidence: 84,
        estimatedSavingsAmount: '42',
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
        toEmail: 'support@example.com',
        ccEmails: [],
        subject: 'Need clarification',
        bodyMarkdown: 'Body',
      },
    });
    const run = await prisma.actionRun.create({
      data: {
        actionRequestId: actionRequest.id,
        status: ActionRunStatus.DELIVERED,
        mailgunMessageId: '<thread-id@example.com>',
      },
    });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'inbound-token';
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? 'test_mailgun_signing_key';
    const signature = createHmac('sha256', signingKey).update(`${timestamp}${token}`).digest('hex');

    const response = await request(app.getHttpServer()).post('/v1/mailgun/webhooks/inbound').send({
      signature: {
        timestamp,
        token,
        signature,
      },
      sender: 'support@example.com',
      subject: 'Re: Need clarification',
      'body-plain': 'Issue fixed and refund completed.',
      'In-Reply-To': '<thread-id@example.com>',
    });

    expect(response.status).toBe(201);
    expect(response.body.matchedActionRunId).toBe(run.id);
    expect(response.body.resolvedByKeyword).toBe(true);
    expect(response.body.parseDecision).toBe('resolved');
    expect(typeof response.body.parseScore).toBe('number');

    const updatedRun = await prisma.actionRun.findUnique({ where: { id: run.id } });
    expect(updatedRun?.status).toBe(ActionRunStatus.RESOLVED);

    const inboundMailEvent = await prisma.mailEvent.findFirst({
      where: {
        actionRunId: run.id,
        event: 'inbound_reply',
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });
    expect(inboundMailEvent).not.toBeNull();
    if (inboundMailEvent) {
      const payload = inboundMailEvent.payloadJson as {
        _parse?: { decision?: string; classifierVersion?: string };
      };
      expect(payload._parse?.decision).toBe('resolved');
      expect(payload._parse?.classifierVersion).toBe('rule-v2');
    }
  });

  it('tracks inbound parsing false-positive and false-negative feedback labels', async () => {
    const org = await prisma.organization.create({ data: { name: 'Org Inbound Feedback' } });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'inbound-feedback.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'inbound-feedback-owner' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.OWNER,
      },
    });

    const fpFinding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'FP feedback finding',
        summary: 'For false-positive feedback case',
        confidence: 76,
        estimatedSavingsAmount: '13',
        currency: 'USD',
      },
    });
    const fpRequest = await prisma.actionRequest.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        findingId: fpFinding.id,
        type: ActionType.CLARIFICATION,
        status: ActionRequestStatus.APPROVED,
        toEmail: 'ops@example.com',
        ccEmails: [],
        subject: 'FP request',
        bodyMarkdown: 'Body',
      },
    });
    await prisma.actionRun.create({
      data: {
        actionRequestId: fpRequest.id,
        status: ActionRunStatus.DELIVERED,
        mailgunMessageId: '<fp-thread@example.com>',
      },
    });

    const fnFinding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.POST_CANCELLATION,
        status: FindingStatus.OPEN,
        title: 'FN feedback finding',
        summary: 'For false-negative feedback case',
        confidence: 79,
        estimatedSavingsAmount: '21',
        currency: 'USD',
      },
    });
    const fnRequest = await prisma.actionRequest.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        findingId: fnFinding.id,
        type: ActionType.CLARIFICATION,
        status: ActionRequestStatus.APPROVED,
        toEmail: 'ops@example.com',
        ccEmails: [],
        subject: 'FN request',
        bodyMarkdown: 'Body',
      },
    });
    await prisma.actionRun.create({
      data: {
        actionRequestId: fnRequest.id,
        status: ActionRunStatus.DELIVERED,
        mailgunMessageId: '<fn-thread@example.com>',
      },
    });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? 'test_mailgun_signing_key';
    const fpToken = 'fp-token';
    const fpSignature = createHmac('sha256', signingKey)
      .update(`${timestamp}${fpToken}`)
      .digest('hex');
    const fnToken = 'fn-token';
    const fnSignature = createHmac('sha256', signingKey)
      .update(`${timestamp}${fnToken}`)
      .digest('hex');

    const fpInbound = await request(app.getHttpServer())
      .post('/v1/mailgun/webhooks/inbound')
      .send({
        signature: {
          timestamp,
          token: fpToken,
          signature: fpSignature,
        },
        sender: 'support@example.com',
        subject: 'Re: FP request',
        'body-plain': 'Issue fixed and refund completed.',
        'In-Reply-To': '<fp-thread@example.com>',
      });
    expect(fpInbound.status).toBe(201);
    expect(fpInbound.body.parseDecision).toBe('resolved');

    const fnInbound = await request(app.getHttpServer())
      .post('/v1/mailgun/webhooks/inbound')
      .send({
        signature: {
          timestamp,
          token: fnToken,
          signature: fnSignature,
        },
        sender: 'support@example.com',
        subject: 'Re: FN request',
        'body-plain': 'Thanks for the details. We can close the case now.',
        'In-Reply-To': '<fn-thread@example.com>',
      });
    expect(fnInbound.status).toBe(201);
    expect(fnInbound.body.parseDecision).toBe('uncertain');

    const token = await createSessionToken({
      sub: 'inbound-feedback-owner',
      shopDomain: shop.shopifyDomain,
    });

    const fpManual = await request(app.getHttpServer())
      .post(`/v1/action-requests/${fpRequest.id}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'WAITING_REPLY' });
    expect(fpManual.status).toBe(201);

    const fnManual = await request(app.getHttpServer())
      .post(`/v1/action-requests/${fnRequest.id}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'RESOLVED' });
    expect(fnManual.status).toBe(201);

    const metrics = await request(app.getHttpServer())
      .get(`/v1/action-requests/inbound-parse/metrics?shopId=${shop.id}&windowDays=30`)
      .set('authorization', `Bearer ${token}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.labels.FALSE_POSITIVE).toBeGreaterThanOrEqual(1);
    expect(metrics.body.labels.FALSE_NEGATIVE).toBeGreaterThanOrEqual(1);
    expect(metrics.body.labeledFeedback).toBeGreaterThanOrEqual(2);
  });

  it('allows AGENCY_ADMIN to approve action requests in-tenant', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Org Agency Admin Action', plan: Plan.STARTER },
    });
    const shop = await prisma.shop.create({
      data: {
        orgId: org.id,
        shopifyDomain: 'agency-admin-action.myshopify.com',
        installedAt: new Date(),
      },
    });
    const user = await prisma.user.create({ data: { shopifyUserId: 'agency-admin-action-user' } });
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: OrgRole.AGENCY_ADMIN,
      },
    });
    const finding = await prisma.leakFinding.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        type: LeakType.UNINSTALLED_APP_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Agency admin finding',
        summary: 'Agency admin can approve',
        confidence: 72,
        estimatedSavingsAmount: '99',
        currency: 'USD',
      },
    });
    const actionRequest = await prisma.actionRequest.create({
      data: {
        orgId: org.id,
        shopId: shop.id,
        findingId: finding.id,
        type: ActionType.CLARIFICATION,
        status: ActionRequestStatus.DRAFT,
        toEmail: 'ops@example.com',
        ccEmails: [],
        subject: 'Approve by agency admin',
        bodyMarkdown: 'Body',
        createdByUserId: user.id,
      },
    });

    const token = await createSessionToken({
      sub: 'agency-admin-action-user',
      shopDomain: shop.shopifyDomain,
    });

    const approve = await request(app.getHttpServer())
      .post(`/v1/action-requests/${actionRequest.id}/approve`)
      .set('authorization', `Bearer ${token}`)
      .send({});

    expect(approve.status).toBe(201);
    expect(approve.body.actionRequest.status).toBe('APPROVED');
    expect(approve.body.actionRun.status).toBe('QUEUED');
  });
});
