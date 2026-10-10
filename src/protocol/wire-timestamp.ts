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

export function isCanonicalWireTimestamp(value: unknown): boolean {
  return typeof value === 'string';
}
