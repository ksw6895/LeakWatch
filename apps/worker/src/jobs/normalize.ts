import { DocStatus } from '@prisma/client';
import {
  RUN_DETECTION_JOB_NAME,
  type NormalizeInvoiceJobPayload,
  type RunDetectionJobPayload,
} from '@leakwatch/shared';
import type { Queue } from 'bullmq';
import type pino from 'pino';

import { prisma } from '../db';
import { LLMClient } from '../llm/client';
import { persistNormalizedInvoice } from '../normalization/persistence';
import { maskPii, numberLinesByPage, trimForPrompt } from '../normalization/text';
import { coerceNormalizedInvoice, validateNormalizedInvoice } from '../normalization/validator';

const llmClient = new LLMClient();

async function markNormalizationFailure(
  documentVersionId: string,
  errorCode: string,
  errorMessage: string,
  logger: pino.Logger,
) {
  await prisma.documentVersion.update({
    where: { id: documentVersionId },
    data: {
      status: DocStatus.NORMALIZATION_FAILED,
      errorCode,
      errorMessage: errorMessage.slice(0, 900),
    },
  });

  logger.error({ documentVersionId, errorCode, errorMessage }, 'Normalization failed');
}

export async function processNormalizeInvoiceJob(
  payload: NormalizeInvoiceJobPayload,
  queue: Queue,
  logger: pino.Logger,
) {
  const documentVersion = await prisma.documentVersion.findUnique({
    where: { id: payload.documentVersionId },
    include: {
      extracted: true,
      document: {
        include: {
          shop: true,
        },
      },
    },
  });

  if (!documentVersion) {
    return { skipped: true, reason: 'DOCUMENT_VERSION_NOT_FOUND' };
  }

  const skipStatuses = new Set<DocStatus>([
    DocStatus.NORMALIZED,
    DocStatus.DETECTION_RUNNING,
    DocStatus.DETECTED,
  ]);
  if (skipStatuses.has(documentVersion.status)) {
    return { skipped: true, reason: 'ALREADY_NORMALIZED' };
  }

  if (!documentVersion.extracted) {
    await markNormalizationFailure(
      documentVersion.id,
      'NORMALIZATION_SCHEMA_INVALID',
      'Missing extracted artifact',
      logger,
    );
    return { skipped: true, reason: 'MISSING_EXTRACTED_ARTIFACT' };
  }

  await prisma.documentVersion.update({
    where: { id: documentVersion.id },
    data: {
      status: DocStatus.NORMALIZATION_RUNNING,
      errorCode: null,
      errorMessage: null,
    },
  });

  let usage = { inputTokens: 0, outputTokens: 0 };

  try {
    const numbered = numberLinesByPage(documentVersion.extracted.textContent);
    const masked = maskPii(numbered);
    const selected = trimForPrompt(masked);

    const promptMeta = {
      documentVersionId: documentVersion.id,
      sourceType: documentVersion.document.source,
      fileName: documentVersion.fileName,
      mimeType: documentVersion.mimeType,
      sha256: documentVersion.sha256,
      shopId: documentVersion.document.shopId,
      shopifyDomain: documentVersion.document.shop.shopifyDomain,
    } as const;

    const normalizedResult = await llmClient.normalizeInvoice(promptMeta, selected.text);
    usage = {
      inputTokens: usage.inputTokens + normalizedResult.usage.inputTokens,
      outputTokens: usage.outputTokens + normalizedResult.usage.outputTokens,
    };

    let payloadCandidate = normalizedResult.json;
    let validation = validateNormalizedInvoice(payloadCandidate);

    if (!validation.ok) {
      const repaired = await llmClient.repairNormalizedInvoice(
        payloadCandidate,
        validation.issues,
        promptMeta,
      );
      usage = {
        inputTokens: usage.inputTokens + repaired.usage.inputTokens,
        outputTokens: usage.outputTokens + repaired.usage.outputTokens,
      };
      payloadCandidate = repaired.json;
      validation = validateNormalizedInvoice(payloadCandidate);
    }

    if (!validation.ok) {
      await markNormalizationFailure(
        documentVersion.id,
        'NORMALIZATION_REPAIR_FAILED',
        JSON.stringify(validation.issues),
        logger,
      );
      return { ok: false, issues: validation.issues };
    }

    const normalizedInvoice = coerceNormalizedInvoice(payloadCandidate);

    const persisted = await persistNormalizedInvoice(prisma, {
      documentVersionId: documentVersion.id,
      orgId: documentVersion.document.orgId,
      shopId: documentVersion.document.shopId,
      normalizedInvoice,
      tokenUsage: usage,
    });

    await queue.add(
      RUN_DETECTION_JOB_NAME,
      {
        documentVersionId: documentVersion.id,
        shopId: documentVersion.document.shopId,
      } satisfies RunDetectionJobPayload,
      {
        jobId: `${RUN_DETECTION_JOB_NAME}-${documentVersion.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    logger.info(
      {
        documentVersionId: documentVersion.id,
        invoiceId: persisted.invoiceId,
        lineItemCount: persisted.lineItemCount,
        promptTrimmed: selected.reduced,
      },
      'Normalization completed and detection job enqueued',
    );

    return {
      ok: true,
      invoiceId: persisted.invoiceId,
      lineItemCount: persisted.lineItemCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = message.includes('schema') ? 'NORMALIZATION_SCHEMA_INVALID' : 'NORMALIZATION_REPAIR_FAILED';
    await markNormalizationFailure(documentVersion.id, errorCode, message, logger);
    throw error;
  }
}
