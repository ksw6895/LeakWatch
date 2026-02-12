import { describe, expect, it } from 'vitest';

import { validateNormalizedInvoice } from '../src/normalization/validator';

function createValidPayload() {
  return {
    schemaVersion: '1.0',
    source: {
      documentVersionId: 'dv_1',
      sourceType: 'UPLOAD',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sha256: 'a'.repeat(64),
    },
    merchant: {
      shopId: 'shop_1',
      shopifyDomain: 'acme.myshopify.com',
    },
    vendor: {
      name: 'Acme Billing',
      category: 'SAAS',
    },
    invoice: {
      currency: 'USD',
      totalAmount: '150.00',
      invoiceDate: '2026-02-01T00:00:00Z',
    },
    lineItems: [
      {
        lineId: 'li_1',
        type: 'CHARGE',
        amount: '150.00',
        currency: 'USD',
        evidence: {
          kind: 'PDF_TEXT_SPAN',
          pointer: {
            page: 1,
            lineStart: 10,
            lineEnd: 12,
          },
          excerpt: 'Total 150.00',
        },
      },
    ],
    quality: {
      confidence: 88,
      missingFields: [],
      warnings: [],
    },
  };
}

describe('validateNormalizedInvoice', () => {
  it('accepts a valid normalized invoice payload', () => {
    const result = validateNormalizedInvoice(createValidPayload());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects payloads without required invoice fields', () => {
    const payload = createValidPayload() as Record<string, any>;
    delete payload.invoice.totalAmount;

    const result = validateNormalizedInvoice(payload);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path.includes('/invoice') || issue.path === '/')).toBe(
      true,
    );
  });
});
