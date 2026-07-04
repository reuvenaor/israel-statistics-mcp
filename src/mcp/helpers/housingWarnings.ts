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

/**
 * Approximate the provisional transaction window: publications lag ~2 months
 * behind transactions, and the last 3 bi-monthly publications (≈6 months of
 * transactions) are still provisional.
 */
export function getProvisionalWindow(now: Date = new Date()): {
  start: { year: number; month: number }
  end: { year: number; month: number }
  label: string
} {
  // Latest published data month: ~2 months back (publication around the 15th).
  const publicationLag = now.getDate() >= 15 ? 2 : 3
  const end = new Date(now.getFullYear(), now.getMonth() - publicationLag, 1)
  // Three bi-monthly publications ≈ six months of provisional transactions.
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  return {
    start: { year: start.getFullYear(), month: start.getMonth() + 1 },
    end: { year: end.getFullYear(), month: end.getMonth() + 1 },
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
      `🔄 Provisional data: the last 3 published indices (transactions ~${window.label}) may still be revised when late transaction reports arrive.`
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
