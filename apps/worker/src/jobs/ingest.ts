import { DocStatus, type Prisma } from '@prisma/client';
import {
  NORMALIZE_INVOICE_JOB_NAME,
  type IngestDocumentJobPayload,
  type NormalizeInvoiceJobPayload,
} from '@leakwatch/shared';
import type { Queue } from 'bullmq';
import type pino from 'pino';

import { prisma } from '../db';
import { extractDocument } from '../extractors/service';
import { LLMClient } from '../llm/client';
import { incrementOpenAiUsage } from '../normalization/usage';
import { R2StorageClient } from '../storage/r2.client';

const llmClient = new LLMClient();
const storageClient = new R2StorageClient();

function toExtractionErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNSUPPORTED_MIME')) {
    return 'UNSUPPORTED_MIME';
  }
  if (message.includes('PDF_TEXT_EXTRACTION_EMPTY')) {
    return 'PDF_TEXT_EXTRACTION_EMPTY';
  }
  if (message.includes('IMAGE_TEXT_EXTRACTION_FAILED')) {
    return 'IMAGE_TEXT_EXTRACTION_FAILED';
  }
  if (message.includes('FILE_DOWNLOAD_FAILED')) {
    return 'FILE_DOWNLOAD_FAILED';
  }
  return 'EXTRACTION_FAILED';
}

export async function processIngestDocumentJob(
  payload: IngestDocumentJobPayload,
  queue: Queue,
  logger: pino.Logger,
) {
  const documentVersion = await prisma.documentVersion.findUnique({
    where: { id: payload.documentVersionId },
    include: {
      document: {
        select: {
          id: true,
          orgId: true,
          shopId: true,
          source: true,
        },
      },
      extracted: true,
    },
  });

  if (!documentVersion) {
    logger.warn({ documentVersionId: payload.documentVersionId }, 'Document version not found');
    return { skipped: true, reason: 'DOCUMENT_VERSION_NOT_FOUND' };
  }

  const skipStatuses = new Set<DocStatus>([
    DocStatus.NORMALIZATION_RUNNING,
    DocStatus.NORMALIZED,
    DocStatus.DETECTION_RUNNING,
    DocStatus.DETECTED,
  ]);
  if (skipStatuses.has(documentVersion.status)) {
    return { skipped: true, reason: 'ALREADY_PROCESSED' };
  }

  if (documentVersion.status === DocStatus.EXTRACTED && documentVersion.extracted) {
    await queue.add(
      NORMALIZE_INVOICE_JOB_NAME,
      {
        documentVersionId: documentVersion.id,
      } satisfies NormalizeInvoiceJobPayload,
      {
        jobId: `${NORMALIZE_INVOICE_JOB_NAME}-${documentVersion.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    return { skipped: true, reason: 'ALREADY_EXTRACTED_ENQUEUED_NORMALIZE' };
  }

  await prisma.documentVersion.update({
    where: { id: documentVersion.id },
    data: {
      status: DocStatus.EXTRACTION_RUNNING,
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    const fileBuffer = await storageClient.getObject(documentVersion.storageKey);
    const extracted = await extractDocument(fileBuffer, documentVersion.mimeType, llmClient);

    await prisma.extractedArtifact.upsert({
      where: { documentVersionId: documentVersion.id },
      create: {
        documentVersionId: documentVersion.id,
        textContent: extracted.textContent,
        metaJson: extracted.metaJson as Prisma.InputJsonValue,
      },
      update: {
        textContent: extracted.textContent,
        metaJson: extracted.metaJson as Prisma.InputJsonValue,
      },
    });

    if (extracted.tokenUsage) {
      await incrementOpenAiUsage(prisma, {
        orgId: documentVersion.document.orgId,
        shopId: documentVersion.document.shopId,
        inputTokens: extracted.tokenUsage.inputTokens,
        outputTokens: extracted.tokenUsage.outputTokens,
      });
    }

    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: {
        status: DocStatus.EXTRACTED,
        errorCode: null,
        errorMessage: null,
      },
    });

    await queue.add(
      NORMALIZE_INVOICE_JOB_NAME,
      {
        documentVersionId: documentVersion.id,
      } satisfies NormalizeInvoiceJobPayload,
      {
        jobId: `${NORMALIZE_INVOICE_JOB_NAME}-${documentVersion.id}`,
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
        mimeType: documentVersion.mimeType,
      },
      'Extraction completed and normalization job enqueued',
    );

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = toExtractionErrorCode(error);

    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: {
        status: DocStatus.EXTRACTION_FAILED,
        errorCode,
        errorMessage: message.slice(0, 900),
      },
    });

    logger.error(
      {
        documentVersionId: documentVersion.id,
        errorCode,
        error: message,
      },
      'Extraction failed',
    );

    throw error;
  }
}
