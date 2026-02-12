import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import normalizedInvoiceSchema from '@leakwatch/shared/schemas/normalizedInvoice.schema.json';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const validate = ajv.compile(normalizedInvoiceSchema);

export type NormalizationValidationResult = {
  ok: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
};

function formatErrors(errors: ErrorObject[] | null | undefined): NormalizationValidationResult['errors'] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? 'invalid',
  }));
}

export function validateNormalizedInvoice(payload: unknown): NormalizationValidationResult {
  const ok = validate(payload);
  return {
    ok: Boolean(ok),
    errors: formatErrors(validate.errors),
  };
}
