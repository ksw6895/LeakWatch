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

type InboundParseDecision = 'resolved' | 'waiting_reply' | 'uncertain';

type InboundParseResult = {
  decision: InboundParseDecision;
  score: number;
  matchedPositiveSignals: string[];
  matchedNegativeSignals: string[];
  matchedUncertainSignals: string[];
  classifierVersion: 'rule-v2';
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

function parseInboundResolutionSignal(subject: string, bodyText: string): InboundParseResult {
  const normalized = `${subject}\n${bodyText}`.toLowerCase();

  const positiveSignals: Array<{ phrase: string; weight: number }> = [
    { phrase: 'resolved', weight: 2 },
    { phrase: 'issue fixed', weight: 3 },
    { phrase: 'fixed now', weight: 3 },
    { phrase: 'refund completed', weight: 3 },
    { phrase: 'refund issued', weight: 3 },
    { phrase: 'refund processed', weight: 3 },
    { phrase: 'we refunded', weight: 2 },
    { phrase: 'canceled and refunded', weight: 3 },
    { phrase: 'cancelled and refunded', weight: 3 },
    { phrase: 'closed the case', weight: 2 },
  ];

  const negativeSignals: Array<{ phrase: string; weight: number }> = [
    { phrase: 'not resolved', weight: 4 },
    { phrase: 'unresolved', weight: 4 },
    { phrase: 'issue persists', weight: 4 },
    { phrase: 'still charged', weight: 3 },
    { phrase: 'still being charged', weight: 3 },
    { phrase: 'cannot refund', weight: 3 },
    { phrase: 'can not refund', weight: 3 },
    { phrase: 'unable to refund', weight: 3 },
    { phrase: 'investigating', weight: 2 },
    { phrase: 'looking into', weight: 2 },
    { phrase: 'working on this', weight: 2 },
    { phrase: 'pending review', weight: 2 },
  ];

  const uncertainSignals = [
    'please clarify',
    'can you share',
    'need more information',
    'follow up',
  ];

  const matchedPositiveSignals = positiveSignals
    .filter((signal) => normalized.includes(signal.phrase))
    .map((signal) => signal.phrase);
  const matchedNegativeSignals = negativeSignals
    .filter((signal) => normalized.includes(signal.phrase))
    .map((signal) => signal.phrase);
  const matchedUncertainSignals = uncertainSignals.filter((phrase) => normalized.includes(phrase));

  const positiveScore = positiveSignals
    .filter((signal) => matchedPositiveSignals.includes(signal.phrase))
    .reduce((sum, signal) => sum + signal.weight, 0);
  const negativeScore = negativeSignals
    .filter((signal) => matchedNegativeSignals.includes(signal.phrase))
    .reduce((sum, signal) => sum + signal.weight, 0);
  const uncertainPenalty = matchedUncertainSignals.length > 0 ? 1 : 0;
  const score = positiveScore - negativeScore - uncertainPenalty;

  let decision: InboundParseDecision = 'uncertain';
  if (matchedNegativeSignals.length > 0 && negativeScore >= positiveScore) {
    decision = 'waiting_reply';
  } else if (score >= 2) {
    decision = 'resolved';
  } else if (score <= -1) {
    decision = 'waiting_reply';
  }

  return {
    decision,
    score,
    matchedPositiveSignals,
    matchedNegativeSignals,
    matchedUncertainSignals,
    classifierVersion: 'rule-v2',
  };
}

function extractMessageIdCandidates(payload: MailgunInboundPayload): string[] {
  const sourceText = [
    payload['In-Reply-To'],
    payload.References,
    payload.subject,
    payload['stripped-text'],
    payload['body-plain'],
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  const bracketed = Array.from(sourceText.matchAll(/<([^>]+)>/g)).map((match) => match[1] ?? '');
  const prefixed = Array.from(
    sourceText.matchAll(
      /(?:message-id|in-reply-to|references)\s*[:=]\s*([\w.!#$%&'*+/=?^`{|}~-]+@[\w.-]+)/gi,
    ),
  ).map((match) => match[1] ?? '');

  return Array.from(new Set([...bracketed, ...prefixed]));
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

    const normalizedCandidates = extractMessageIdCandidates(payload)
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
    const subject = typeof payload.subject === 'string' ? payload.subject : '';
    const parseResult = parseInboundResolutionSignal(subject, bodyText);
    const shouldResolve = parseResult.decision === 'resolved';

    const occurredAt = new Date();
    await this.prisma.mailEvent.create({
      data: {
        ...(actionRun ? { actionRunId: actionRun.id } : {}),
        mailgunMessageId: normalizedCandidates[0] ?? 'unknown',
        event: 'inbound_reply',
        payloadJson: {
          ...payload,
          _parse: parseResult,
        } as unknown as Prisma.InputJsonValue,
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
            parseDecision: parseResult.decision,
            parseScore: parseResult.score,
            parseClassifierVersion: parseResult.classifierVersion,
            matchedPositiveSignals: parseResult.matchedPositiveSignals,
            matchedNegativeSignals: parseResult.matchedNegativeSignals,
            matchedUncertainSignals: parseResult.matchedUncertainSignals,
            snippet: bodyText.slice(0, 280),
          },
        },
      });
    }

    return {
      ok: true,
      matchedActionRunId: actionRun?.id ?? null,
      resolvedByKeyword: shouldResolve,
      parseDecision: parseResult.decision,
      parseScore: parseResult.score,
    };
  }
}
