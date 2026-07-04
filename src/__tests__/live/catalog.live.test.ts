/**
 * LIVE tests — real requests against api.cbs.gov.il (run via `pnpm test:live`).
 * Sequential + retried by the vitest live project config.
 */
import { describe, expect, it } from "vitest"
import { getCatalogChapters } from "../../mcp/handlers/getCatalogChapters"
import { getChapterTopics } from "../../mcp/handlers/getChapterTopics"
import { getIndexTopics } from "../../mcp/handlers/getIndexTopics"
import { getSubjectCodes } from "../../mcp/handlers/getSubjectCodes"

const HEBREW = /[֐-׿]/

describe("live: catalog discovery chain", () => {
  it("lists at least the 11 documented chapters in English", async () => {
    const result = await getCatalogChapters({ lang: "en" })
    // CBS grows the catalog over time (14 as of 2026, incl. new g/j) —
    // assert the documented core, not an exact count.
    expect(result.chapters.length).toBeGreaterThanOrEqual(11)
    const ids = result.chapters.map((c) => c.chapterId)
    expect(ids).toContain("a")
    expect(ids).toContain("aa")
    expect(ids).toContain("fa")
    expect(result.chapters[0].chapterName).not.toMatch(HEBREW)
  })

  it("lists chapters in Hebrew by default", async () => {
    const result = await getCatalogChapters({})
    expect(result.chapters.length).toBeGreaterThanOrEqual(11)
    expect(result.chapters.some((c) => HEBREW.test(c.chapterName ?? ""))).toBe(
      true
    )
  })

  it("searches topics by keyword in English", async () => {
    const result = await getIndexTopics({
      lang: "en",
      searchText: "housing",
      pagesize: 20,
    })
    expect(result.summary).toMatch(/Found \d+ index codes/)
    expect(result.topics.length).toBeGreaterThan(0)
  })

  it("returns a clean zero-hit result for nonsense search text", async () => {
    // NOTE: hyphenated strings (e.g. "zzz-nope") trip the CBS WAF into an
    // HTML error page — which secureFetch surfaces as a clean CbsApiError
    // (unit-tested). Plain text probes the true zero-hit path.
    const result = await getIndexTopics({
      lang: "en",
      searchText: "zzzznope",
    })
    expect(result.summary).toContain("Found 0 index codes")
  })

  it("filters topics to quarterly-updated indices", async () => {
    const result = await getIndexTopics({ lang: "en", period: "Q" })
    expect(result.topics.length).toBeGreaterThan(0)
  })

  it("warns about the housing market when browsing chapter aa", async () => {
    const result = await getChapterTopics({ chapterId: "aa", lang: "en" })
    expect(result.topics.length).toBeGreaterThan(0)
    expect(result.summary).toContain("Housing Price Index")
    expect(result.summary).toContain("bi-monthly")
  })

  it("chains chapter -> topics -> subject codes", async () => {
    const topics = await getChapterTopics({ chapterId: "a", lang: "en" })
    const subjectId = topics.topics[0].subjectId
    expect(subjectId).toBeTypeOf("number")

    const codes = await getSubjectCodes({ subjectId, lang: "en" })
    expect(codes.codes.length).toBeGreaterThan(0)
    expect(codes.codes[0].codeId).toBeTypeOf("number")
    expect(codes.codes[0].codeName.length).toBeGreaterThan(0)
  })
})
