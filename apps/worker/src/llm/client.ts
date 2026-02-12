import OpenAI from 'openai';

import normalizedInvoiceSchema from '@leakwatch/shared/schemas/normalizedInvoice.schema.json';

import { getWorkerEnv } from '../env';

type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type NormalizePromptMeta = {
  documentVersionId: string;
  sourceType: 'UPLOAD' | 'EMAIL_FORWARD';
  fileName: string;
  mimeType: string;
  sha256: string;
  shopId: string;
  shopifyDomain?: string;
};

export class LLMClient {
  private readonly env = getWorkerEnv();
  private readonly client = this.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      })
    : null;

  private async withRetry<T>(fn: () => Promise<T>) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.env.OPENAI_MAX_RETRIES; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === this.env.OPENAI_MAX_RETRIES) {
          break;
        }

        const delay = 300 * 2 ** (attempt - 1) + Math.floor(Math.random() * 120);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('OpenAI request failed');
  }

  private ensureClient() {
    if (!this.client) {
      throw new Error('OPENAI_API_KEY is required for Step 05 normalization');
    }
    return this.client;
  }

  private parseUsage(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): LlmUsage {
    return {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
    };
  }

  async normalizeInvoice(meta: NormalizePromptMeta, textWithLineNumbers: string) {
    const client = this.ensureClient();

    const systemPrompt = [
      'You are a meticulous finance operations assistant.',
      'Return JSON only and ensure it matches the given schema exactly.',
      'Never invent values. Use null only if truly not present, and add field names in quality.missingFields.',
      'Each line item must contain evidence.pointer and evidence.excerpt with line references from the source text.',
    ].join(' ');

    const userPrompt = [
      `documentVersionId: ${meta.documentVersionId}`,
      `sourceType: ${meta.sourceType}`,
      `fileName: ${meta.fileName}`,
      `mimeType: ${meta.mimeType}`,
      `sha256: ${meta.sha256}`,
      `shopId: ${meta.shopId}`,
      `shopifyDomain: ${meta.shopifyDomain ?? ''}`,
      '',
      'Source text (line-numbered):',
      textWithLineNumbers,
    ].join('\n');

    return this.withRetry(async () => {
      const response = await client.chat.completions.create({
        model: this.env.OPENAI_MODEL_NORMALIZE,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'normalized_invoice',
            schema: normalizedInvoiceSchema,
            strict: true,
          },
        },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty normalization response');
      }

      return {
        json: JSON.parse(content) as unknown,
        usage: this.parseUsage(response.usage),
      };
    });
  }

  async repairNormalizedInvoice(
    originalPayload: unknown,
    issues: Array<{ path: string; message: string }>,
    meta: NormalizePromptMeta,
  ) {
    const client = this.ensureClient();

    const response = await this.withRetry(async () =>
      client.chat.completions.create({
        model: this.env.OPENAI_MODEL_NORMALIZE,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'normalized_invoice_repair',
            schema: normalizedInvoiceSchema,
            strict: true,
          },
        },
        messages: [
          {
            role: 'system',
            content:
              'Repair JSON to satisfy schema strictly. Return JSON only. Preserve existing values when valid.',
          },
          {
            role: 'user',
            content: [
              `documentVersionId: ${meta.documentVersionId}`,
              `shopId: ${meta.shopId}`,
              '',
              'Validation issues:',
              JSON.stringify(issues, null, 2),
              '',
              'Payload to repair:',
              JSON.stringify(originalPayload),
            ].join('\n'),
          },
        ],
      }),
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty repair response');
    }

    return {
      json: JSON.parse(content) as unknown,
      usage: this.parseUsage(response.usage),
    };
  }

  async extractImageLines(imageBuffer: Buffer, mimeType: string) {
    const client = this.ensureClient();
    const imageBase64 = imageBuffer.toString('base64');

    const response = await this.withRetry(async () =>
      client.chat.completions.create({
        model: this.env.OPENAI_MODEL_VISION,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract readable invoice text lines from the image. Return JSON only with shape {"lines": ["..."]}.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract invoice-relevant text lines in display order. No numbering, no markdown.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty image extraction response');
    }

    const parsed = JSON.parse(content) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) {
      throw new Error('Invalid image extraction payload');
    }

    return {
      lines: parsed.lines.map((line) => String(line)).filter((line) => line.trim().length > 0),
      usage: this.parseUsage(response.usage),
    };
  }
}

