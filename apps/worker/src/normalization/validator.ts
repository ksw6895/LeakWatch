import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import normalizedInvoiceSchema from '@leakwatch/shared/schemas/normalizedInvoice.schema.json';

import type { NormalizedInvoice } from './types';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const validate = ajv.compile(normalizedInvoiceSchema);

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

function formatIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? 'invalid',
  }));
}

export function validateNormalizedInvoice(payload: unknown): ValidationResult {
  const ok = validate(payload);
  return {
    ok: Boolean(ok),
    issues: formatIssues(validate.errors),
  };
}

export function coerceNormalizedInvoice(payload: unknown): NormalizedInvoice {
  return payload as NormalizedInvoice;
}
