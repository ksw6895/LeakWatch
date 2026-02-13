import { describe, expect, it } from 'vitest';

import { maskPii } from '../src/normalization/text';

describe('maskPii', () => {
  it('masks phone numbers', () => {
    const input = 'support phone: +1 (212) 555-0199';
    expect(maskPii(input)).toContain('[PHONE]');
  });

  it('does not mask ISO date values used for billing periods', () => {
    const input = 'billing_period_start=2025-01-01 billing_period_end=2025-01-31';
    const masked = maskPii(input);
    expect(masked).toContain('2025-01-01');
    expect(masked).toContain('2025-01-31');
    expect(masked).not.toContain('[PHONE]');
  });
});
