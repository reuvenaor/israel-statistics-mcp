/**
 * LIVE tests — real requests against api.cbs.gov.il (run via `pnpm test:live`).
 * Includes the 110050 null-coefficient regression from TODOS.md.
 */
import { describe, expect, it } from "vitest"
import { getIndexCalculator } from "../../mcp/handlers/getIndexCalculator"

describe("live: price linkage calculator", () => {
  it("links 1000 NIS on general CPI (120010)", async () => {
    const result = await getIndexCalculator({
      indexCode: 120010,
      value: 1000,
      fromDate: "2020-01-01",
      toDate: "2025-06-01",
      lang: "en",
    })
    expect(result.answer.to_value).toBeGreaterThan(1000)
    expect(result.answer.from_value).toBe(1000)
    expect(result.summary).toMatch(/% change/)
  })

  it("REGRESSION: 110050 succeeds despite null mult_min/mult_max", async () => {
    // Published v0.0.2 failed this exact call with a raw ZodError dump.
    const result = await getIndexCalculator({
      indexCode: 110050,
      value: 1000,
      fromDate: "2020-01-01",
      toDate: "2025-06-01",
      lang: "en",
    })
    expect(result.answer.mult_min).toBeNull()
    expect(result.answer.mult_max).toBeNull()
    expect(result.answer.to_value).toBeGreaterThan(0)
    expect(result.summary).toContain("% change")
  })

  it("normalizes Israeli dd-mm-yyyy input before hitting CBS", async () => {
    const result = await getIndexCalculator({
      indexCode: 120010,
      value: 500,
      fromDate: "15-01-2020", // dd-mm spelling, day>12 → unambiguous
      toDate: "2024-06-15",
      lang: "en",
    })
    // CBS echoes the dates it actually used — proof of correct parsing
    expect(result.request.from_date).toBe("2020-01-15")
    expect(result.request.to_date).toBe("2024-06-15")
  })

  it("supports historic currency linkage (old sheqel)", async () => {
    const result = await getIndexCalculator({
      indexCode: 120010,
      value: 100,
      fromDate: "1990-01-01",
      toDate: "2020-01-01",
      currency: "old_sheqel",
      lang: "en",
    })
    expect(result.answer.to_value).toBeGreaterThan(0)
  })
})
