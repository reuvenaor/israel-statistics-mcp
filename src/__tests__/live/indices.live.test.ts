/**
 * LIVE tests — real requests against api.cbs.gov.il (run via `pnpm test:live`).
 */
import { describe, expect, it } from "vitest"
import { getAllIndices } from "../../mcp/handlers/getAllIndices"
import { getIndexData } from "../../mcp/handlers/getIndexData"
import {
  getMainIndices,
  getMainIndicesByPeriod,
} from "../../mcp/handlers/getMainIndices"

const HEBREW = /[֐-׿]/

describe("live: index time series (get_index_data)", () => {
  it("returns 12 finite monthly points for CPI 2023", async () => {
    const result = await getIndexData({
      code: "120010",
      startPeriod: "01-2023",
      endPeriod: "12-2023",
      lang: "en",
    })
    const points = result.data.month?.[0]?.date ?? []
    expect(points.length).toBe(12)
    for (const p of points) {
      expect(Number.isFinite(p.currBase.value)).toBe(true)
    }
    expect(result.summary).toContain("Retrieved 12 data points")
  })

  it("handles an empty date range cleanly (no ZodError)", async () => {
    const result = await getIndexData({
      code: "120010",
      startPeriod: "01-1900",
      endPeriod: "02-1900",
      lang: "en",
    })
    expect(result.summary).toContain("No data points found")
  })

  it("respects last=3", async () => {
    const result = await getIndexData({ code: "120010", last: 3, lang: "en" })
    const points = result.data.month?.[0]?.date ?? []
    expect(points.length).toBeLessThanOrEqual(3)
    expect(points.length).toBeGreaterThan(0)
  })

  it("returns linkage coefficients with coef=true", async () => {
    const result = await getIndexData({
      code: "120010",
      last: 2,
      coef: true,
      lang: "en",
    })
    const entry = result.data.month?.[0]?.date[0]
    expect(entry).toBeDefined()
    // coef=true switches prevBase to an array of bases with coefficients
    expect(Array.isArray(entry?.prevBase)).toBe(true)
  })

  it("clamps pagesize to the CBS cap", async () => {
    const result = await getIndexData({
      code: "120010",
      pagesize: 1000,
      lang: "en",
    })
    expect(result.data.paging.page_size).toBeLessThanOrEqual(1000)
  })

  it("warns about housing when fetching an 18xxxx code", async () => {
    const result = await getIndexData({ code: "180010", last: 3, lang: "en" })
    expect(result.summary).toContain("Housing Price Index")
  })
})

describe("live: main indices", () => {
  it("returns the current snapshot with finite-or-null percents", async () => {
    const result = await getMainIndices({ lang: "en" })
    expect(result.indices.length).toBeGreaterThan(0)
    expect(result.updateDate).toBeTruthy()
    for (const index of result.indices) {
      expect(
        index.percent === null || Number.isFinite(index.percent)
      ).toBe(true)
      for (const value of index.indices) {
        expect(value.value === null || Number.isFinite(value.value)).toBe(true)
      }
    }
  })

  it("supports the legacy oldFormat flag", async () => {
    const result = await getMainIndices({ oldFormat: true })
    expect(result.indices.length).toBeGreaterThan(0)
  })

  it("groups a 3-month range by month", async () => {
    const result = await getMainIndicesByPeriod({
      startDate: "202401",
      endDate: "202403",
    })
    expect(result.totalIndices).toBeGreaterThan(0)
    expect(Object.keys(result.groupedByDate).length).toBe(3)
    expect(result.indices[0].code).toMatch(/^\d+$/)
  })
})

describe("live: all indices tree", () => {
  it("filters to a single chapter in English", async () => {
    const result = await getAllIndices({ chapter: "a", lang: "en" })
    expect(result.summary).toMatch(/Retrieved \d+ indices for chapter a/)
  })

  it("returns Hebrew content by default and warns for housing chapter", async () => {
    const result = await getAllIndices({ chapter: "aa" })
    expect(result.summary).toContain("Housing Price Index")
    expect(JSON.stringify(result.indices)).toMatch(HEBREW)
  })
})
