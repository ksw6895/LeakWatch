import type { LLMClient } from '../llm/client';
import type { ExtractedArtifactResult } from '../normalization/types';

export async function extractImage(
  buffer: Buffer,
  mimeType: string,
  llmClient: LLMClient,
): Promise<ExtractedArtifactResult> {
  const extraction = await llmClient.extractImageLines(buffer, mimeType);
  if (extraction.lines.length === 0) {
    throw new Error('IMAGE_TEXT_EXTRACTION_FAILED');
  }

  return {
    textContent: extraction.lines.join('\n'),
    metaJson: {
      extractor: 'image-vision',
      lines: extraction.lines.length,
    },
    tokenUsage: extraction.usage,
  };
}
