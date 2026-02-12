export type SourceType = 'UPLOAD' | 'EMAIL_FORWARD';
export type VendorCategory =
  | 'SHOPIFY_APP'
  | 'SAAS'
  | 'PAYMENT'
  | 'SHIPPING'
  | 'MARKETING'
  | 'ANALYTICS'
  | 'UNKNOWN';
export type LineItemType = 'CHARGE' | 'REFUND' | 'CREDIT';
export type RecurringCadence = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'ONE_TIME';
export type EvidenceKind = 'PDF_TEXT_SPAN' | 'CSV_ROW' | 'IMAGE_OCR_LINE';

export type NormalizedInvoice = {
  schemaVersion: '1.0';
  source: {
    documentVersionId: string;
    sourceType: SourceType;
    fileName: string;
    mimeType: string;
    sha256: string;
  };
  merchant: {
    shopId: string;
    shopifyDomain?: string;
    contactEmail?: string;
  };
  vendor: {
    name: string;
    canonicalName?: string;
    supportEmail?: string;
    website?: string;
    category?: VendorCategory;
  };
  invoice: {
    invoiceNumber?: string;
    invoiceDate?: string;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    currency: string;
    subtotalAmount?: string;
    taxAmount?: string;
    totalAmount: string;
    paymentMethodHint?: string;
    notes?: string;
  };
  lineItems: Array<{
    lineId: string;
    type: LineItemType;
    description?: string;
    quantity?: string;
    unitPrice?: string;
    amount: string;
    currency: string;
    periodStart?: string;
    periodEnd?: string;
    isRecurring?: boolean;
    recurringCadence?: RecurringCadence;
    planName?: string;
    productCode?: string;
    taxAmount?: string;
    evidence: {
      kind: EvidenceKind;
      pointer: {
        page?: number;
        lineStart?: number;
        lineEnd?: number;
        row?: number;
        col?: string;
      };
      excerpt: string;
    };
  }>;
  quality: {
    confidence: number;
    missingFields: string[];
    warnings: string[];
  };
};

export type ExtractedArtifactResult = {
  textContent: string;
  metaJson: Record<string, unknown>;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
};
