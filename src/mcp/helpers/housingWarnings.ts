/**
 * Housing Price Index warnings.
 *
 * The Housing Price Index (chapter "aa", index codes 18xxxx) is special:
 * - Bi-monthly publication (every other month, around the 15th)
 * - The published index compares transactions from t-2/t-3 months
 * - The last 3 published values are PROVISIONAL and get revised as late
 *   transaction reports arrive — linking money through that window is unsafe.
 */
import { compareYearMonth, toYearMonth } from "./dates"

export interface HousingCheckInput {
  chapter?: string
  code?: string | number
  indexName?: string
  /** Requested end period, any CBS spelling (mm-yyyy, yyyymm, yyyy-mm-dd). */
  targetPeriod?: string
  /** Injectable clock for tests. */
  now?: Date
}

export interface HousingWarning {
  isHousingRelated: boolean
  warnings: string[]
}

const HOUSING_NAME_PATTERN =
  /housing|dwelling|apartment|real estate|מחירי דירות|מחירי הדירות|שוק הדיור|דיור|נדל"ן/i

// Housing market index codes are the 18xxxx range (e.g. 180010).
function isHousingCode(code: string | number | undefined): boolean {
  if (code == null) return false
  const s = String(code)
  return /^18\d{4}$/.test(s)
}

// CBS publishes on Israel local dates. Reading the publication day off the host
// clock puts a UTC+13 server a calendar day ahead, which can flip a period that
// is still provisional into the "these values are final" branch below.
const ISRAEL_TIME_ZONE = "Asia/Jerusalem"

const israelDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

function toIsraelDate(now: Date): {
  year: number
  month: number
  day: number
} {
  const parts = israelDateParts.formatToParts(now)
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  return { year: part("year"), month: part("month"), day: part("day") }
}

/**
 * Approximate the provisional transaction window. Publications lag ~2 months
 * behind the transactions they describe, and CBS keeps revising the last 3
 * published values.
 */
export function getProvisionalWindow(now: Date = new Date()): {
  start: { year: number; month: number }
  end: { year: number; month: number }
  label: string
} {
  const today = toIsraelDate(now)
  // INSTRUCTIONS.md: "for a date between July 16th and August 15th, the last
  // published index is based on transactions in April-May". So the index
  // published on the 15th only becomes the latest one AFTER the 15th — on the
  // 15th itself the previous month's publication is still the most recent.
  const publicationLag = today.day > 15 ? 2 : 3
  // UTC arithmetic: month rollover must not depend on host DST.
  const end = new Date(
    Date.UTC(today.year, today.month - 1 - publicationLag, 1)
  )
  // Deliberately conservative: cover ~6 months of transactions behind the
  // latest publication. Over-warning only costs a caution; under-warning would
  // declare still-provisional values "final" for money linkage.
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1)
  )

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  return {
    start: { year: start.getUTCFullYear(), month: start.getUTCMonth() + 1 },
    end: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1 },
    label: `${fmt(start)} through ${fmt(end)}`,
  }
}

export function checkHousingWarnings(input: HousingCheckInput): HousingWarning {
  const { chapter, code, indexName, targetPeriod } = input
  const isHousingRelated =
    chapter === "aa" ||
    isHousingCode(code) ||
    (indexName != null && HOUSING_NAME_PATTERN.test(indexName))

  if (!isHousingRelated) {
    return { isHousingRelated: false, warnings: [] }
  }

  const warnings: string[] = [
    "⚠️ Housing Price Index: bi-monthly publication based on transactions from 2-3 months before the publication date.",
  ]

  const window = getProvisionalWindow(input.now)
  const target = toYearMonth(targetPeriod)
  const targetBeforeWindow =
    target != null && compareYearMonth(target, window.start) < 0

  if (targetBeforeWindow) {
    // The requested period is old enough to be final — no provisional risk.
    warnings.push(
      `✅ The requested period predates the current provisional window (${window.label}), so these values are final.`
    )
  } else {
    warnings.push(
      `🔄 Provisional data: CBS revises the last 3 published Housing Price Index values as late transaction reports arrive. Treat transactions from ~${window.label} as still subject to revision.`
    )
    warnings.push(
      "💡 For price linkage over recent periods, prefer an end date before the provisional window or expect small revisions."
    )
  }

  return { isHousingRelated, warnings }
}

export function addHousingWarningsToSummary(
  summary: string,
  housingWarning: HousingWarning
): string {
  if (!housingWarning.isHousingRelated) {
    return summary
  }
  return `${summary} ${housingWarning.warnings.join(" ")}`
}
