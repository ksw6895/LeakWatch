import type { SendEmailJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

import { ActionRunStatus } from '@prisma/client';

import { prisma } from '../db';
import { getWorkerEnv } from '../env';
import { R2StorageClient } from '../storage/r2.client';

const env = getWorkerEnv();
const storageClient = new R2StorageClient();

function asMessageId(value: string): string {
  const normalized = value.trim().replace(/^<|>$/g, '');
  return `<${normalized}>`;
}

export async function processSendEmailJob(payload: SendEmailJobPayload, logger: pino.Logger) {
  const actionRun = await prisma.actionRun.findUnique({
    where: {
      id: payload.actionRunId,
    },
    include: {
      actionRequest: true,
    },
  });

  if (!actionRun) {
    return { skipped: true, reason: 'ACTION_RUN_NOT_FOUND' };
  }

  if (actionRun.status === ActionRunStatus.DELIVERED || actionRun.status === ActionRunStatus.SENT) {
    return { skipped: true, reason: 'ALREADY_SENT' };
  }

  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    await prisma.actionRun.update({
      where: {
        id: actionRun.id,
      },
      data: {
        status: ActionRunStatus.FAILED,
        lastError: 'MAILGUN_NOT_CONFIGURED',
      },
    });
    return {
      ok: false,
      reason: 'MAILGUN_NOT_CONFIGURED',
    };
  }

  await prisma.actionRun.update({
    where: {
      id: actionRun.id,
    },
    data: {
      status: ActionRunStatus.SENDING,
      lastError: null,
    },
  });

  const form = new FormData();
  form.set('from', `LeakWatch <noreply@${env.MAILGUN_DOMAIN}>`);
  form.set('to', actionRun.actionRequest.toEmail);
  if (actionRun.actionRequest.ccEmails.length > 0) {
    form.set('cc', actionRun.actionRequest.ccEmails.join(','));
  }
  form.set('subject', actionRun.actionRequest.subject);
  form.set('text', actionRun.actionRequest.bodyMarkdown);

  if (actionRun.actionRequest.attachmentKey) {
    const attachment = await storageClient.getObject(actionRun.actionRequest.attachmentKey);
    const file = new File([attachment], 'evidence-pack.zip', {
      type: 'application/zip',
    });
    form.append('attachment', file);
  }

  const response = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64')}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await prisma.actionRun.update({
      where: {
        id: actionRun.id,
      },
      data: {
        status: ActionRunStatus.FAILED,
        lastError: `MAILGUN_SEND_FAILED:${response.status}:${errorBody}`,
      },
    });

    throw new Error(`MAILGUN_SEND_FAILED:${response.status}`);
  }

  const body = (await response.json()) as { id?: string };
  const messageId = asMessageId(body.id ?? `${actionRun.id}@${env.MAILGUN_DOMAIN}`);

  await prisma.actionRun.update({
    where: {
      id: actionRun.id,
    },
    data: {
      status: ActionRunStatus.SENT,
      mailgunMessageId: messageId,
      lastError: null,
    },
  });

  logger.info(
    {
      actionRunId: actionRun.id,
      actionRequestId: actionRun.actionRequestId,
      messageId,
    },
    'Action email sent',
  );

  return {
    ok: true,
    actionRunId: actionRun.id,
    messageId,
  };
}
