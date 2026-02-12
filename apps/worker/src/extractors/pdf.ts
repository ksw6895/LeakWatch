import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LLMClient } from '../llm/client';
import type { ExtractedArtifactResult } from '../normalization/types';

import { runCommand } from './process';

export async function extractPdf(buffer: Buffer, llmClient: LLMClient): Promise<ExtractedArtifactResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'lw-pdf-'));
  const pdfPath = join(tempDir, 'source.pdf');
  const textPath = join(tempDir, 'source.txt');

  try {
    await writeFile(pdfPath, buffer);
    await runCommand('pdftotext', ['-layout', pdfPath, textPath]);

    const extractedText = await readFile(textPath, 'utf8').catch(() => '');
    if (extractedText.trim().length > 0) {
      const pages = extractedText.split('\f').filter((page) => page.trim().length > 0);
      return {
        textContent: extractedText,
        metaJson: {
          extractor: 'pdf-pdftotext',
          pages: pages.length || 1,
          fallbackVision: false,
        },
      };
    }

    const prefix = join(tempDir, 'page');
    await runCommand('pdftoppm', ['-png', pdfPath, prefix]);

    const files = await readdir(tempDir);
    const pngPages = files
      .filter((fileName) => /^page-\d+\.png$/.test(fileName))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pngPages.length === 0) {
      throw new Error('PDF_TEXT_EXTRACTION_EMPTY');
    }

    const linesByPage: string[] = [];
    const tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
    };
    for (let index = 0; index < pngPages.length; index += 1) {
      const fileName = pngPages[index];
      if (!fileName) {
        continue;
      }
      const imageBuffer = await readFile(join(tempDir, fileName));
      const extracted = await llmClient.extractImageLines(imageBuffer, 'image/png');
      linesByPage.push(extracted.lines.join('\n'));
      tokenUsage.inputTokens += extracted.usage.inputTokens;
      tokenUsage.outputTokens += extracted.usage.outputTokens;
    }

    const textContent = linesByPage.join('\f');
    if (!textContent.trim()) {
      throw new Error('PDF_TEXT_EXTRACTION_EMPTY');
    }

    return {
      textContent,
      metaJson: {
        extractor: 'pdf-pdftoppm-vision',
        pages: pngPages.length,
        fallbackVision: true,
      },
      tokenUsage,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
