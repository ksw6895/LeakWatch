import { EvidenceKind, FindingStatus, LeakType, Prisma } from '@prisma/client';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildEvidencePackZip } from '../src/evidence/pack';

describe('buildEvidencePackZip', () => {
  it('includes summary, invoice, excerpts, and metadata files', async () => {
    const zipBuffer = await buildEvidencePackZip({
      finding: {
        id: 'finding_1',
        orgId: 'org_1',
        shopId: 'shop_1',
        type: LeakType.DUPLICATE_CHARGE,
        status: FindingStatus.OPEN,
        title: 'Potential duplicate charge',
        summary: 'Two matching charges found in same period.',
        confidence: 90,
        estimatedSavingsAmount: new Prisma.Decimal('150'),
        currency: 'USD',
        vendorId: null,
        periodStart: null,
        periodEnd: null,
        primaryLineItemId: null,
        createdAt: new Date('2026-02-13T00:00:00Z'),
        updatedAt: new Date('2026-02-13T00:00:00Z'),
      },
      evidence: [
        {
          id: 'ev_1',
          findingId: 'finding_1',
          documentVersionId: 'dv_1',
          kind: EvidenceKind.PDF_TEXT_SPAN,
          pointerJson: {
            page: 1,
            lineStart: 10,
            lineEnd: 12,
          },
          excerpt: 'Monthly plan - $150',
          createdAt: new Date('2026-02-13T00:00:00Z'),
        },
      ],
      invoices: [
        {
          fileName: 'invoice.pdf',
          content: Buffer.from('invoice data'),
        },
      ],
    });

    const zip = await JSZip.loadAsync(zipBuffer);
    expect(zip.file('00_case_summary.html')).toBeTruthy();
    expect(zip.file('01_invoices/invoice.pdf')).toBeTruthy();
    expect(zip.file('02_excerpts.txt')).toBeTruthy();
    expect(zip.file('03_metadata.json')).toBeTruthy();

    const excerpts = await zip.file('02_excerpts.txt')?.async('text');
    expect(excerpts).toContain('Monthly plan - $150');
  });
});
