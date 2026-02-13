export const INGESTION_QUEUE_NAME = 'ingestion';
export const INGEST_DOCUMENT_JOB_NAME = 'INGEST_DOCUMENT';
export const NORMALIZE_INVOICE_JOB_NAME = 'NORMALIZE_INVOICE';
export const RUN_DETECTION_JOB_NAME = 'RUN_DETECTION';
export const GENERATE_EVIDENCE_PACK_JOB_NAME = 'GENERATE_EVIDENCE_PACK';
export const SEND_EMAIL_JOB_NAME = 'SEND_EMAIL';
export const REPORT_GENERATE_JOB_NAME = 'REPORT_GENERATE';

export type IngestDocumentJobPayload = {
  documentVersionId: string;
};

export type NormalizeInvoiceJobPayload = {
  documentVersionId: string;
};

export type RunDetectionJobPayload = {
  documentVersionId: string;
  shopId: string;
};

export type GenerateEvidencePackJobPayload = {
  actionRequestId: string;
};

export type SendEmailJobPayload = {
  actionRunId: string;
};

export type ReportGenerateJobPayload = {
  shopId: string;
  period: 'WEEKLY' | 'MONTHLY';
  trigger: 'manual' | 'weekly' | 'monthly';
};
