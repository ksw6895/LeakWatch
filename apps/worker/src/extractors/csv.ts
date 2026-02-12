import { parse } from 'csv-parse/sync';

import type { ExtractedArtifactResult } from '../normalization/types';

function detectDelimiter(text: string) {
  const firstLine = text.split('\n')[0] ?? '';
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semicolon = (firstLine.match(/;/g) ?? []).length;
  const tab = (firstLine.match(/\t/g) ?? []).length;

  if (semicolon > comma && semicolon >= tab) {
    return ';';
  }
  if (tab > comma && tab > semicolon) {
    return '\t';
  }
  return ',';
}

export function extractCsv(buffer: Buffer): ExtractedArtifactResult {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(text);
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    delimiter,
  }) as Array<Record<string, string>>;

  const lines = rows.map((row, index) => {
    const columns = Object.entries(row)
      .map(([key, value]) => `${key}=${String(value ?? '').trim()}`)
      .join(' | ');
    return `row ${index + 1}: ${columns}`;
  });

  const textContent = lines.join('\n');

  return {
    textContent,
    metaJson: {
      extractor: 'csv',
      delimiter,
      rows: rows.length,
    },
  };
}

