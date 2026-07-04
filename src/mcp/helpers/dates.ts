/**
 * CBS calculator date handling.
 *
 * The CBS calculator endpoint accepts `mm-dd-yyyy` or `yyyy-mm-dd` — but NOT
 * `dd-mm-yyyy`. Israeli users (and models working in an Israeli context)
 * naturally write dd-mm-yyyy, which CBS silently misparses into a wrong month
 * — producing a wrong financial result with no error. We therefore normalize
 * every accepted spelling to the unambiguous `yyyy-mm-dd` before sending.
 *
 * Precedence for `a-b-yyyy` inputs:
 *   - a > 12 and b <= 12  → unambiguously dd-mm-yyyy → reordered
 *   - a <= 12 and b <= 12 → treated as the documented mm-dd-yyyy
 *   - a <= 12 and b > 12  → mm-dd-yyyy with day > 12
 *   - both > 12           → rejected
 */

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function checkedDate(year: number, month: number, day: number): string {
  if (year < 1900 || year > 2100) {
    throw new Error(`Invalid date: year ${year} is out of range (1900-2100)`)
  }
  if (month < 1 || month > 12) {
    throw new Error(`Invalid date: month ${month} is out of range (1-12)`)
  }
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    throw new Error(
      `Invalid date: day ${day} is out of range for month ${month}`
    )
  }
  const mm = String(month).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

export function normalizeCalculatorDate(input: string): string {
  const cleaned = input.trim().replace(/\//g, "-")

  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return checkedDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    )
  }

  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const a = Number(dashMatch[1])
    const b = Number(dashMatch[2])
    const year = Number(dashMatch[3])
    if (a > 12 && b > 12) {
      throw new Error(
        `Invalid date "${input}": neither ${a} nor ${b} is a valid month`
      )
    }
    if (a > 12) {
      // unambiguously dd-mm-yyyy
      return checkedDate(year, b, a)
    }
    // documented CBS order: mm-dd-yyyy
    return checkedDate(year, a, b)
  }

  throw new Error(
    `Invalid date "${input}": use yyyy-mm-dd (recommended), e.g. 2020-01-31`
  )
}

/**
 * Parse assorted CBS period spellings to a comparable year-month.
 * Accepts "mm-yyyy" (index data periods), "yyyymm" (by-period dates),
 * "yyyy-mm" and "yyyy-mm-dd" (calculator dates). Returns null when unparseable.
 */
export function toYearMonth(
  value: string | undefined | null
): { year: number; month: number } | null {
  if (!value) return null
  const v = value.trim()

  let m = v.match(/^(\d{1,2})-(\d{4})$/) // mm-yyyy
  if (m) return { year: Number(m[2]), month: Number(m[1]) }

  m = v.match(/^(\d{4})(\d{2})$/) // yyyymm
  if (m) return { year: Number(m[1]), month: Number(m[2]) }

  m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/) // yyyy-mm or yyyy-mm-dd
  if (m) return { year: Number(m[1]), month: Number(m[2]) }

  return null
}

export function compareYearMonth(
  a: { year: number; month: number },
  b: { year: number; month: number }
): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}
