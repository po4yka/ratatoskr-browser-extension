/**
 * Renders the canonical wire form of an instant: RFC 3339 UTC with a literal `Z`, no fraction when
 * the sub-second part is zero, otherwise the fraction with its trailing zeros trimmed.
 * XR-021 CONTRACTS.md section S10 (CD4); the contracts `WireTimestamp` accepts only this form.
 */
export function formatWireTimestamp(date: Date): string {
  return date.toISOString().replace(/(\.\d*?)0+Z$/, '$1Z').replace(/\.Z$/, 'Z');
}

const canonicalWireTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{0,8}[1-9])?Z$/;

/** The validator rule of XR-021 CONTRACTS.md section S10 (CD4): a fraction, when present, does not end in zero. */
export function isCanonicalWireTimestamp(value: unknown): boolean {
  return typeof value === 'string' && canonicalWireTimestamp.test(value);
}

const utcDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * Re-renders a stored timestamp into the canonical wire form. Only a full UTC date-time that names a
 * real instant is accepted: `Date.parse` rolls an impossible date such as February 31 over to the
 * next month, so the rendered seconds must equal the input seconds. A value that is already
 * canonical is returned unchanged so sub-millisecond digits survive. Anything else (unparsable
 * text, an offset other than `Z`, an impossible date) yields `undefined`.
 */
export function canonicalizeWireTimestamp(text: string): string | undefined {
  if (!utcDateTime.test(text)) return undefined;
  const instant = Date.parse(text);
  if (Number.isNaN(instant)) return undefined;
  const rendered = formatWireTimestamp(new Date(instant));
  if (rendered.slice(0, 19) !== text.slice(0, 19)) return undefined;
  return isCanonicalWireTimestamp(text) ? text : rendered;
}
