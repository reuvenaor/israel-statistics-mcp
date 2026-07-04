/**
 * CBS XML payloads type every numeric as string and occasionally ship empty
 * or non-numeric values ("", "-", "N/A"). parseFloat would silently turn
 * those into NaN, which JSON.stringify then serializes as null — corrupting
 * output while claiming `number`. Make the null explicit and typed instead.
 */
export function parseNumberOrNull(
  value: string | undefined | null
): number | null {
  if (value == null) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}
