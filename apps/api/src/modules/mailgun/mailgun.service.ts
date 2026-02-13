import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ActionRunStatus, type Prisma } from '@prisma/client';

import { getApiEnv } from '../../config/env';
import { PrismaService } from '../../common/prisma/prisma.service';

type MailgunEventPayload = {
  signature?: {
    timestamp?: string;
    token?: string;
    signature?: string;
  };
  'event-data'?: Record<string, unknown>;
  eventData?: Record<string, unknown>;
};

type MailgunInboundPayload = MailgunEventPayload & {
  sender?: string;
  subject?: string;
  'stripped-text'?: string;
  'body-plain'?: string;
  'In-Reply-To'?: string;
  References?: string;
};

function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '');
}

function toDateFromSeconds(value: unknown): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed * 1000);
    }
  }

  return new Date();
}

@Injectable()
export class MailgunService {
  private readonly env = getApiEnv();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private verifySignature(payload: MailgunEventPayload) {
    const signingKey = this.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      throw new UnauthorizedException('Mailgun webhook is not configured');
    }

    const timestamp = payload.signature?.timestamp;
    const token = payload.signature?.token;
    const signature = payload.signature?.signature;

    if (!timestamp || !token || !signature) {
      throw new UnauthorizedException('Invalid Mailgun signature payload');
    }

    const digest = createHmac('sha256', signingKey).update(`${timestamp}${token}`).digest('hex');

    const actual = Buffer.from(digest, 'utf8');
    const expected = Buffer.from(signature, 'utf8');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Invalid Mailgun signature');
    }
  }

  async handleWebhook(payload: MailgunEventPayload) {
    this.verifySignature(payload);

    const eventData = payload['event-data'] ?? payload.eventData;
    const eventName = typeof eventData?.event === 'string' ? eventData.event : 'unknown';
    const rawMessageId =
      typeof eventData?.['message-id'] === 'string'
        ? eventData['message-id']
        : typeof (eventData?.message as { headers?: { 'message-id'?: unknown } } | undefined)
              ?.headers?.['message-id'] === 'string'
          ? String(
              (eventData?.message as { headers?: { 'message-id'?: unknown } }).headers?.[
                'message-id'
              ],
            )
          : null;

    const normalizedMessageId = rawMessageId ? normalizeMessageId(rawMessageId) : null;

    const actionRun = normalizedMessageId
      ? await this.prisma.actionRun.findFirst({
          where: {
            mailgunMessageId: {
              in: [normalizedMessageId, `<${normalizedMessageId}>`],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;

    const occurredAt = toDateFromSeconds(eventData?.timestamp);

    await this.prisma.mailEvent.create({
      data: {
        ...(actionRun ? { actionRunId: actionRun.id } : {}),
        mailgunMessageId: normalizedMessageId ?? 'unknown',
        event: eventName,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        occurredAt,
      },
    });

    if (actionRun) {
      let status: ActionRunStatus | null = null;
      let lastError: string | null = null;

      if (eventName === 'delivered') {
        status = ActionRunStatus.DELIVERED;
      } else if (
        eventName === 'failed' ||
        eventName === 'temporary_fail' ||
        eventName === 'permanent_fail' ||
        eventName === 'rejected' ||
        eventName === 'complained'
      ) {
        status = ActionRunStatus.FAILED;
        lastError = typeof eventData?.reason === 'string' ? eventData.reason : eventName;
      }

      if (status) {
        await this.prisma.actionRun.update({
          where: {
            id: actionRun.id,
          },
          data: {
            status,
            ...(lastError ? { lastError } : {}),
          },
        });
      }
    }

    return {
      ok: true,
      event: eventName,
      matchedActionRunId: actionRun?.id ?? null,
    };
  }

  async handleInboundWebhook(payload: MailgunInboundPayload) {
    this.verifySignature(payload);

    const candidates = [
      payload['In-Reply-To'],
      payload.References,
      payload['stripped-text'],
      payload['body-plain'],
    ]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');

    const messageIds = Array.from(candidates.matchAll(/<([^>]+)>/g)).map((match) => match[1] ?? '');
    const normalizedCandidates = messageIds
      .map((value) => normalizeMessageId(value))
      .filter((value) => value.length > 0);

    const actionRun = normalizedCandidates.length
      ? await this.prisma.actionRun.findFirst({
          where: {
            mailgunMessageId: {
              in: normalizedCandidates.flatMap((value) => [value, `<${value}>`]),
            },
          },
          include: {
            actionRequest: {
              select: {
                orgId: true,
                shopId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;

    const bodyText =
      (typeof payload['stripped-text'] === 'string' ? payload['stripped-text'] : null) ??
      (typeof payload['body-plain'] === 'string' ? payload['body-plain'] : null) ??
      '';
    const lowered = bodyText.toLowerCase();
    const resolvedKeywords = [
      'resolved',
      'refund completed',
      'issue fixed',
      'cancelled',
      'canceled',
    ];
    const hasNegativeContext =
      lowered.includes('not resolved') ||
      lowered.includes('unresolved') ||
      lowered.includes('issue persists');
    const shouldResolve =
      !hasNegativeContext && resolvedKeywords.some((keyword) => lowered.includes(keyword));

    const occurredAt = new Date();
    await this.prisma.mailEvent.create({
      data: {
        ...(actionRun ? { actionRunId: actionRun.id } : {}),
        mailgunMessageId: normalizedCandidates[0] ?? 'unknown',
        event: 'inbound_reply',
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        occurredAt,
      },
    });

    if (actionRun) {
      if (shouldResolve) {
        await this.prisma.actionRun.update({
          where: {
            id: actionRun.id,
          },
          data: {
            status: ActionRunStatus.RESOLVED,
            lastError: null,
          },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          orgId: actionRun.actionRequest.orgId,
          shopId: actionRun.actionRequest.shopId,
          action: 'ACTION_INBOUND_REPLY_RECEIVED',
          targetType: 'action_run',
          targetId: actionRun.id,
          metaJson: {
            sender: payload.sender ?? null,
            subject: payload.subject ?? null,
            resolvedByKeyword: shouldResolve,
            snippet: bodyText.slice(0, 280),
          },
        },
      });
    }

    return {
      ok: true,
      matchedActionRunId: actionRun?.id ?? null,
      resolvedByKeyword: shouldResolve,
    };
  }
}
