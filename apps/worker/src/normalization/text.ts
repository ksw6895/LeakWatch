const FORM_FEED = '\f';
const MAX_LINES_FOR_PROMPT = 450;

export function normalizeTextContent(rawText: string): string {
  return rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function splitPages(rawText: string): string[] {
  const normalized = normalizeTextContent(rawText);
  return normalized.split(FORM_FEED).map((page) => page.trim()).filter(Boolean);
}

export function numberLinesByPage(rawText: string): string {
  const pages = splitPages(rawText);
  if (pages.length === 0) {
    return '';
  }

  const chunks: string[] = [];
  pages.forEach((page, pageIndex) => {
    const lines = page
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    chunks.push(`=== Page ${pageIndex + 1} ===`);
    lines.forEach((line, lineIndex) => {
      chunks.push(`[${lineIndex + 1}] ${line}`);
    });
  });

  return chunks.join('\n');
}

function looksLikeDateToken(value: string): boolean {
  const token = value.trim();
  return (
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(token) ||
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(token)
  );
}

export function maskPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (match) =>
      looksLikeDateToken(match) ? match : '[PHONE]',
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD]')
    .replace(/\b\d{1,5}\s+[A-Za-z0-9.\s]{3,}\s(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDR]');
}

function looksInvoiceRelated(line: string): boolean {
  return /(?:usd|eur|krw|\$|€|subtotal|total|tax|invoice|period|plan|subscription|refund|credit|charge|\d{4}-\d{2}-\d{2})/i.test(
    line,
  );
}

export function trimForPrompt(numberedText: string): { text: string; reduced: boolean } {
  const lines = numberedText.split('\n');
  if (lines.length <= MAX_LINES_FOR_PROMPT) {
    return { text: numberedText, reduced: false };
  }

  const selected = lines.filter((line) => line.startsWith('=== Page ') || looksInvoiceRelated(line));
  const result = selected.slice(0, MAX_LINES_FOR_PROMPT);
  return {
    text: result.join('\n'),
    reduced: true,
  };
}
