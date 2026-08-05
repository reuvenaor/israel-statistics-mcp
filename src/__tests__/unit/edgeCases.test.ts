import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import xml2js from "xml2js"
import {
  compareYearMonth,
  normalizeCalculatorDate,
  toYearMonth,
} from "../../mcp/helpers/dates"
import { parseNumberOrNull } from "../../mcp/helpers/numbers"
import {
  checkHousingWarnings,
  getProvisionalWindow,
} from "../../mcp/helpers/housingWarnings"
import {
  catalogChaptersResponseSchema,
  chapterTopicsResponseSchema,
  indexCalculatorResponseSchema,
  indexDataResponseSchema,
  mainIndicesByPeriodXmlResponseSchema,
} from "../../schemas/response.schema"
import {
  getIndexCalculatorSchema,
  getIndexDataSchema,
  getMainIndicesByPeriodSchema,
} from "../../schemas/request.schema"

vi.mock("../../mcp/helpers/fetcher", () => ({
  secureFetch: vi.fn(),
  GlobalParams: {},
  // Real value from fetcher.ts — handlers default pagesize to it.
  CBS_MAX_PAGESIZE: 1000,
}))

import { secureFetch } from "../../mcp/helpers/fetcher"
import { getIndexCalculator } from "../../mcp/handlers/getIndexCalculator"
import { getMainIndicesByPeriod } from "../../mcp/handlers/getMainIndices"
const mockSecureFetch = vi.mocked(secureFetch)

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")
}

function parseXmlLikeFetcher(xml: string): Promise<unknown> {
  const parser = new xml2js.Parser({
    explicitArray: true,
    ignoreAttrs: false,
    mergeAttrs: true,
  })
  return parser.parseStringPromise(xml)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("calculator null coefficients (TODOS.md bug — live repro 110050)", () => {
  it("accepts the real 110050 payload where mult_min/mult_max are null", () => {
    const payload = JSON.parse(fixture("calculator-110050-null-coeffs.json"))
    const parsed = indexCalculatorResponseSchema.parse(payload)
    expect(parsed.answer.mult_min).toBeNull()
    expect(parsed.answer.mult_max).toBeNull()
    expect(parsed.answer.to_value).toBeCloseTo(1193.05)
  })

  it("still accepts the fully-numeric 120010 payload", () => {
    const payload = JSON.parse(fixture("calculator-120010.json"))
    const parsed = indexCalculatorResponseSchema.parse(payload)
    expect(parsed.answer.mult_min).not.toBeNull()
  })

  it("computes a fallback percent in the summary when change_percent is null", async () => {
    mockSecureFetch.mockResolvedValue({
      request: {
        code: 110050,
        sum: 1000,
        currency: "NEW_SHEQEL",
        from_date: "2020-01-01",
        to_date: "2025-06-01",
      },
      answer: {
        from_value: 1000,
        to_value: 1200,
        base_year: "Average 2018",
        from_index_date: "2019-11",
        from_index_value: 100,
        to_index_date: "2025-4",
        to_index_value: 120,
        chaining_coefficient: null,
        mult_min: null,
        mult_max: null,
        Koeff: null,
        change_percent: null,
      },
    })
    const result = await getIndexCalculator({
      indexCode: 110050,
      value: 1000,
      fromDate: "2020-01-01",
      toDate: "2025-06-01",
    })
    expect(result.summary).toContain("1200")
    expect(result.summary).toContain("20% change")
  })
})

describe("calculator date normalization (CBS rejects dd-mm-yyyy)", () => {
  it.each([
    ["2020-01-15", "2020-01-15"], // ISO passes through
    ["2020-1-3", "2020-01-03"], // ISO, unpadded
    ["01-15-2020", "2020-01-15"], // documented mm-dd-yyyy
    ["05-01-2020", "2020-05-01"], // ambiguous → documented mm-dd order
    ["15-01-2020", "2020-01-15"], // day>12 → unambiguous dd-mm-yyyy
    ["31-12-2024", "2024-12-31"],
    ["2020/06/15", "2020-06-15"], // slash separators tolerated
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeCalculatorDate(input)).toBe(expected)
  })

  it.each([
    "13-13-2020", // no valid month reading
    "31-02-2020", // Feb 31 after dd-mm reordering
    "2020-13-01", // ISO with invalid month
    "01-32-2020", // mm-dd with invalid day
    "not-a-date",
    "2020",
  ])("rejects %s with a clear error", (input) => {
    expect(() => normalizeCalculatorDate(input)).toThrow(/Invalid date/)
  })

  it("sends normalized dates to CBS from the handler", async () => {
    mockSecureFetch.mockResolvedValue({
      request: {
        code: 120010,
        sum: 100,
        currency: "NEW_SHEQEL",
        from_date: "2020-01-15",
        to_date: "2024-06-20",
      },
      answer: {
        from_value: 100,
        to_value: 110,
        base_year: "Average 2022",
        from_index_date: "2020-01",
        from_index_value: 100,
        to_index_date: "2024-06",
        to_index_value: 110,
        chaining_coefficient: 1,
        mult_min: 1,
        mult_max: 1,
        Koeff: 1,
        change_percent: 10,
      },
    })
    await getIndexCalculator({
      indexCode: 120010,
      value: 100,
      fromDate: "15-01-2020", // Israeli dd-mm-yyyy spelling
      toDate: "20-06-2024",
    })
    const params = mockSecureFetch.mock.calls[0][1]
    expect(params.date).toBe("2020-01-15")
    expect(params.toDate).toBe("2024-06-20")
  })
})

describe("request schema validation", () => {
  it("rejects malformed index-data periods", () => {
    expect(
      getIndexDataSchema.safeParse({ code: "120010", startPeriod: "1-2020" })
        .success
    ).toBe(false)
    expect(
      getIndexDataSchema.safeParse({ code: "120010", startPeriod: "13-2020" })
        .success
    ).toBe(false)
    expect(
      getIndexDataSchema.safeParse({ code: "120010", startPeriod: "01-2020" })
        .success
    ).toBe(true)
  })

  it("rejects non-positive or fractional 'last'", () => {
    expect(
      getIndexDataSchema.safeParse({ code: "120010", last: -3 }).success
    ).toBe(false)
    expect(
      getIndexDataSchema.safeParse({ code: "120010", last: 1.5 }).success
    ).toBe(false)
    expect(
      getIndexDataSchema.safeParse({ code: "120010", last: 12 }).success
    ).toBe(true)
  })

  it("ignores the removed 'format' param instead of erroring (backward compat)", () => {
    const parsed = getIndexDataSchema.parse({ code: "120010", format: "xml" })
    expect("format" in parsed).toBe(false)
  })

  it("rejects non-positive calculator values", () => {
    const base = {
      indexCode: 120010,
      fromDate: "2020-01-01",
      toDate: "2024-01-01",
    }
    expect(
      getIndexCalculatorSchema.safeParse({ ...base, value: -5 }).success
    ).toBe(false)
    expect(
      getIndexCalculatorSchema.safeParse({ ...base, value: 0 }).success
    ).toBe(false)
    expect(
      getIndexCalculatorSchema.safeParse({ ...base, value: 100 }).success
    ).toBe(true)
  })

  it("rejects malformed by-period dates", () => {
    expect(
      getMainIndicesByPeriodSchema.safeParse({
        startDate: "202013",
        endDate: "202101",
      }).success
    ).toBe(false)
    expect(
      getMainIndicesByPeriodSchema.safeParse({
        startDate: "2020",
        endDate: "202101",
      }).success
    ).toBe(false)
  })

  it("rejects pre-1997 and inverted by-period ranges in the handler", async () => {
    await expect(
      getMainIndicesByPeriod({ startDate: "199001", endDate: "199012" })
    ).rejects.toThrow(/before 199701/)
    await expect(
      getMainIndicesByPeriod({ startDate: "202412", endDate: "202401" })
    ).rejects.toThrow(/earlier than startDate/)
    expect(mockSecureFetch).not.toHaveBeenCalled()
  })
})

describe("empty XML result sets (must not throw 'Required')", () => {
  it("parses the real empty <indices/> payload to an empty list", async () => {
    const parsed = await parseXmlLikeFetcher(
      fixture("price-selected-b-empty.xml")
    )
    const result = mainIndicesByPeriodXmlResponseSchema.parse(parsed)
    expect(result.indices.ind).toEqual([])
  })

  it("tolerates a fully-empty indices element (string form)", () => {
    const result = mainIndicesByPeriodXmlResponseSchema.parse({ indices: "" })
    expect(result.indices.ind).toEqual([])
  })

  it("returns a clean summary for an empty period range", async () => {
    const parsed = await parseXmlLikeFetcher(
      fixture("price-selected-b-empty.xml")
    )
    mockSecureFetch.mockResolvedValue(
      mainIndicesByPeriodXmlResponseSchema.parse(parsed)
    )
    const result = await getMainIndicesByPeriod({
      startDate: "203501",
      endDate: "203502",
    })
    expect(result.totalIndices).toBe(0)
    expect(result.summary).toContain("No main indices found")
  })
})

describe("NaN guards on XML numerics", () => {
  it.each([
    ["103.5", 103.5],
    ["-0.3", -0.3],
    ["", null],
    ["-", null],
    ["N/A", null],
    [undefined, null],
    [null, null],
  ])("parseNumberOrNull(%j) -> %j", (input, expected) => {
    expect(parseNumberOrNull(input as string | null | undefined)).toBe(expected)
  })

  it("produces null (not NaN) for non-numeric percent in by-period data", async () => {
    mockSecureFetch.mockResolvedValue({
      indices: {
        ind: [
          {
            date: ["2024-01"],
            n: ["General CPI"],
            index: ["103.5"],
            percent: [""],
            code: ["120010"],
            base: ["Average 2022"],
          },
        ],
      },
    })
    const result = await getMainIndicesByPeriod({
      startDate: "202401",
      endDate: "202401",
    })
    expect(result.indices[0].percent).toBeNull()
    expect(result.indices[0].index).toBe(103.5)
    // JSON round-trip stays identical (NaN would have silently become null)
    expect(JSON.parse(JSON.stringify(result)).indices[0].percent).toBeNull()
  })
})

describe("coef=true coefficient passthrough", () => {
  it("preserves the prevBase coefficient array from the real payload", () => {
    const payload = JSON.parse(fixture("price-120010-coef.json"))
    const parsed = indexDataResponseSchema.parse(payload)
    const entry = parsed.month?.[0]?.date[0]
    expect(Array.isArray(entry?.prevBase)).toBe(true)
    const prevBase = entry?.prevBase as Array<{ coeff?: number | null }>
    expect(prevBase[0].coeff).toBeTypeOf("number")
  })
})

describe("chapter topics code array typing", () => {
  it("parses the real chapter-aa payload where code is null", () => {
    const payload = JSON.parse(fixture("catalog-chapter-aa.json"))
    const parsed = chapterTopicsResponseSchema.parse(payload)
    expect(parsed.subject[0].code).toBeNull()
    expect(parsed.subject[0].subjectName).toContain("Dwellings")
  })
})

// REGRESSION for issue #7: chapterId was a z.enum of 11 codes shared by BOTH
// the request schema and the CBS *response* schema. CBS then added chapters
// "g" and "j", and get_catalog_chapters started throwing
//   "Invalid enum value. Expected 'a' | 'aa' | ... received 'g'"
// instead of returning data. The enum is now a permissive pattern; this pins a
// real CBS payload so it cannot come back.
describe("catalog chapters tolerate CBS growing the chapter list", () => {
  const payload = JSON.parse(fixture("catalog-chapters.json"))

  it("parses the real 14-chapter payload including the new g and j", () => {
    const parsed = catalogChaptersResponseSchema.parse(payload)
    const ids = parsed.chapters.map((c) => c.chapterId)

    expect(parsed.chapters).toHaveLength(14)
    expect(ids).toContain("g")
    expect(ids).toContain("j")
  })

  it("keeps the duplicate 'ba' chapter CBS currently returns", () => {
    const parsed = catalogChaptersResponseSchema.parse(payload)
    const ids = parsed.chapters.map((c) => c.chapterId)

    expect(ids.filter((id) => id === "ba")).toHaveLength(2)
  })

  it("accepts chapter ids beyond the ones CBS ships today", () => {
    const withFutureChapter = {
      chapters: [
        ...payload.chapters,
        {
          chapterId: "zz",
          chapterName: "Future",
          chapterOrder: 99,
          mainCode: null,
        },
      ],
    }
    expect(() =>
      catalogChaptersResponseSchema.parse(withFutureChapter)
    ).not.toThrow()
  })
})

describe("housing warnings", () => {
  it("triggers on chapter aa", () => {
    expect(checkHousingWarnings({ chapter: "aa" }).isHousingRelated).toBe(true)
  })

  it("triggers on 18xxxx housing codes (string or number)", () => {
    expect(checkHousingWarnings({ code: "180010" }).isHousingRelated).toBe(true)
    expect(checkHousingWarnings({ code: 180010 }).isHousingRelated).toBe(true)
  })

  it("does NOT trigger on ordinary CPI codes or names", () => {
    expect(checkHousingWarnings({ code: "120010" }).isHousingRelated).toBe(
      false
    )
    expect(
      checkHousingWarnings({ indexName: "Fresh vegetables" }).isHousingRelated
    ).toBe(false)
  })

  it("triggers on Hebrew and English housing names", () => {
    expect(
      checkHousingWarnings({ indexName: "מחירי דירות בבעלות הדיירים" })
        .isHousingRelated
    ).toBe(true)
    expect(
      checkHousingWarnings({ indexName: "Prices of Dwellings" })
        .isHousingRelated
    ).toBe(true)
  })

  it("computes a publication-day-aware provisional window", () => {
    const afterPublication = getProvisionalWindow(new Date(2026, 6, 20)) // Jul 20
    expect(afterPublication.end).toEqual({ year: 2026, month: 5 })
    const beforePublication = getProvisionalWindow(new Date(2026, 6, 10)) // Jul 10
    expect(beforePublication.end).toEqual({ year: 2026, month: 4 })
    expect(
      compareYearMonth(afterPublication.start, afterPublication.end)
    ).toBeLessThan(0)
  })

  // REGRESSION: the boundary was `>= 15`, which advanced the window a full
  // month one day early. INSTRUCTIONS.md: for any date from July 16 through
  // August 15 the LAST published index is the July one (transactions Apr-May),
  // so the publication on the 15th only counts after the 15th.
  it("treats the 15th as before the new publication, the 16th as after", () => {
    // Noon UTC keeps these instants on the same Israel calendar day.
    const on15th = getProvisionalWindow(new Date("2026-08-15T12:00:00Z"))
    expect(on15th.end).toEqual({ year: 2026, month: 5 })

    const on16th = getProvisionalWindow(new Date("2026-08-16T12:00:00Z"))
    expect(on16th.end).toEqual({ year: 2026, month: 6 })
  })

  // REGRESSION: the window was derived from now.getDate(), i.e. the HOST
  // timezone. On a UTC+13 host the Israeli 14th reads as the 15th, which
  // shifted the window and could emit the "these values are final" branch for
  // a period that is still provisional.
  it("derives the window from Israel time, not the host timezone", () => {
    // A deliberately discriminating instant:
    //   Israel   (UTC+3)  -> Aug 15 23:00, day 15 -> lag 3 -> window ends May
    //   Auckland (UTC+12) -> Aug 16 08:00, day 16 -> lag 2 -> window ends June
    // Reading the day off the host clock therefore gives the WRONG answer on
    // any far-east host, and wrongly widens the "final" claim by a month.
    // This assertion must hold whatever TZ the suite runs under — the suite is
    // also executed under TZ=Pacific/Auckland and TZ=UTC in CI.
    const instant = new Date("2026-08-15T20:00:00Z")

    expect(getProvisionalWindow(instant).end).toEqual({
      year: 2026,
      month: 5,
    })
  })

  it("marks old periods as final and recent periods as provisional", () => {
    const now = new Date(2026, 6, 20)
    const old = checkHousingWarnings({
      chapter: "aa",
      targetPeriod: "01-2020",
      now,
    })
    expect(old.warnings.join(" ")).toContain("final")
    const recent = checkHousingWarnings({
      chapter: "aa",
      targetPeriod: "2026-04-15",
      now,
    })
    expect(recent.warnings.join(" ")).toContain("Provisional")
  })
})

describe("period parsing helpers", () => {
  it.each([
    ["01-2020", { year: 2020, month: 1 }],
    ["202401", { year: 2024, month: 1 }],
    ["2024-06", { year: 2024, month: 6 }],
    ["2024-06-15", { year: 2024, month: 6 }],
    ["garbage", null],
    ["", null],
  ])("toYearMonth(%j)", (input, expected) => {
    expect(toYearMonth(input)).toEqual(expected)
  })
})
