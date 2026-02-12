export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'image/png',
  'image/jpeg',
] as const;

export const PRESIGNED_URL_EXPIRES_SECONDS = 600;
