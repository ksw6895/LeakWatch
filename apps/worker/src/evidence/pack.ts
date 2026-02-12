import type { EvidenceRef, LeakFinding } from '@prisma/client';
import JSZip from 'jszip';

type BuildEvidencePackParams = {
  finding: LeakFinding;
  evidence: EvidenceRef[];
  invoices: Array<{
    fileName: string;
    content: Buffer;
  }>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildSummaryHtml(params: BuildEvidencePackParams): string {
  const evidenceRows = params.evidence
    .map((item) => {
      return `<tr><td>${escapeHtml(item.kind)}</td><td><pre>${escapeHtml(item.excerpt)}</pre></td><td><pre>${escapeHtml(JSON.stringify(item.pointerJson))}</pre></td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LeakWatch Evidence Pack</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f7f7f7; }
      pre { white-space: pre-wrap; margin: 0; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(params.finding.title)}</h1>
    <p>${escapeHtml(params.finding.summary)}</p>
    <p>Type: ${escapeHtml(params.finding.type)}</p>
    <p>Confidence: ${params.finding.confidence}</p>
    <p>Estimated savings: ${params.finding.estimatedSavingsAmount.toString()} ${escapeHtml(params.finding.currency)}</p>
    <h2>Evidence</h2>
    <table>
      <thead>
        <tr>
          <th>Kind</th>
          <th>Excerpt</th>
          <th>Pointer</th>
        </tr>
      </thead>
      <tbody>
        ${evidenceRows}
      </tbody>
    </table>
  </body>
</html>`;
}

function buildExcerpts(evidence: EvidenceRef[]): string {
  return evidence
    .map((item, index) => {
      return `${index + 1}. [${item.kind}] ${item.excerpt}\n${JSON.stringify(item.pointerJson)}`;
    })
    .join('\n\n');
}

export async function buildEvidencePackZip(params: BuildEvidencePackParams): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('00_case_summary.html', buildSummaryHtml(params));
  zip.file('02_excerpts.txt', buildExcerpts(params.evidence));
  zip.file(
    '03_metadata.json',
    JSON.stringify(
      {
        findingId: params.finding.id,
        type: params.finding.type,
        confidence: params.finding.confidence,
        estimatedSavingsAmount: params.finding.estimatedSavingsAmount,
        currency: params.finding.currency,
        evidenceCount: params.evidence.length,
      },
      null,
      2,
    ),
  );

  const invoicesFolder = zip.folder('01_invoices');
  for (const invoice of params.invoices) {
    invoicesFolder?.file(invoice.fileName, invoice.content);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
