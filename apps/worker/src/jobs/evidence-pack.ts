import type { GenerateEvidencePackJobPayload } from '@leakwatch/shared';
import type pino from 'pino';

import { prisma } from '../db';
import { buildEvidencePackZip } from '../evidence/pack';
import { R2StorageClient } from '../storage/r2.client';

const storageClient = new R2StorageClient();

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export async function processGenerateEvidencePackJob(
  payload: GenerateEvidencePackJobPayload,
  logger: pino.Logger,
) {
  const actionRequest = await prisma.actionRequest.findUnique({
    where: {
      id: payload.actionRequestId,
    },
    include: {
      finding: {
        include: {
          evidence: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      },
    },
  });

  if (!actionRequest) {
    return { skipped: true, reason: 'ACTION_REQUEST_NOT_FOUND' };
  }

  if (actionRequest.attachmentKey) {
    const exists = await storageClient.exists(actionRequest.attachmentKey);
    if (exists) {
      return {
        reused: true,
        attachmentKey: actionRequest.attachmentKey,
      };
    }
  }

  const evidenceDocumentIds = Array.from(
    new Set(
      actionRequest.finding.evidence
        .map((item) => item.documentVersionId)
        .filter((value): value is string => value !== null),
    ),
  );

  const versions = await prisma.documentVersion.findMany({
    where: {
      id: {
        in: evidenceDocumentIds,
      },
    },
    select: {
      id: true,
      fileName: true,
      storageKey: true,
    },
  });

  const invoices = await Promise.all(
    versions.map(async (version) => {
      const content = await storageClient.getObject(version.storageKey);
      return {
        fileName: `${version.id}-${sanitizeName(version.fileName)}`,
        content,
      };
    }),
  );

  const zipBuffer = await buildEvidencePackZip({
    finding: actionRequest.finding,
    evidence: actionRequest.finding.evidence,
    invoices,
  });

  const attachmentKey =
    actionRequest.attachmentKey ??
    `org/${actionRequest.orgId}/shop/${actionRequest.shopId}/evidence-packs/${actionRequest.id}/evidence-pack.zip`;

  await storageClient.putObject(attachmentKey, zipBuffer, 'application/zip');

  await prisma.actionRequest.update({
    where: {
      id: actionRequest.id,
    },
    data: {
      attachmentKey,
    },
  });

  logger.info(
    {
      actionRequestId: actionRequest.id,
      findingId: actionRequest.findingId,
      attachmentKey,
    },
    'Evidence pack generated',
  );

  return {
    ok: true,
    attachmentKey,
    fileCount: invoices.length,
  };
}
