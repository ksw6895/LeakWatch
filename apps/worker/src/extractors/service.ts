import type { LLMClient } from '../llm/client';
import type { ExtractedArtifactResult } from '../normalization/types';

import { extractCsv } from './csv';
import { extractImage } from './image';
import { extractPdf } from './pdf';

export async function extractDocument(
  fileBuffer: Buffer,
  mimeType: string,
  llmClient: LLMClient,
): Promise<ExtractedArtifactResult> {
  if (mimeType === 'application/pdf') {
    return extractPdf(fileBuffer, llmClient);
  }
  if (mimeType === 'text/csv') {
    return extractCsv(fileBuffer);
  }
  if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
    return extractImage(fileBuffer, mimeType, llmClient);
  }

  throw new Error('UNSUPPORTED_MIME');
}

