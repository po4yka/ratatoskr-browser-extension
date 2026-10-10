/**
 * Renders the canonical wire form of an instant: RFC 3339 UTC with a literal `Z`, no fraction when
 * the sub-second part is zero, otherwise the fraction with its trailing zeros trimmed.
 * XR-021 CONTRACTS.md section S10 (CD4); the contracts `WireTimestamp` accepts only this form.
 */
export function formatWireTimestamp(date: Date): string {
  return date.toISOString().replace(/(\.\d*?)0+Z$/, '$1Z').replace(/\.Z$/, 'Z');
}

export function canonicalizeWireTimestamp(text: string): string | undefined {
  return text;
}

const canonicalWireTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{0,8}[1-9])?Z$/;

/** The validator rule of XR-021 CONTRACTS.md section S10 (CD4): a fraction, when present, does not end in zero. */
export function isCanonicalWireTimestamp(value: unknown): boolean {
  return typeof value === 'string' && canonicalWireTimestamp.test(value);
}
