export const INGESTION_QUEUE_NAME = 'ingestion';
export const INGEST_DOCUMENT_JOB_NAME = 'INGEST_DOCUMENT';
export const NORMALIZE_INVOICE_JOB_NAME = 'NORMALIZE_INVOICE';
export const RUN_DETECTION_JOB_NAME = 'RUN_DETECTION';

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
