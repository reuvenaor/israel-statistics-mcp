import { describe, expect, it, vi, beforeEach } from "vitest"
import { getIndexTopics } from "../../mcp/handlers/getIndexTopics"
import { getCatalogChapters } from "../../mcp/handlers/getCatalogChapters"
import { getChapterTopics } from "../../mcp/handlers/getChapterTopics"
import { getSubjectCodes } from "../../mcp/handlers/getSubjectCodes"
import { getIndexData } from "../../mcp/handlers/getIndexData"
import { getIndexCalculator } from "../../mcp/handlers/getIndexCalculator"
import { getAllIndices } from "../../mcp/handlers/getAllIndices"
import {
  getMainIndices,
  getMainIndicesByPeriod,
} from "../../mcp/handlers/getMainIndices"

// Mock the secureFetch function
vi.mock("../../mcp/helpers/fetcher", () => ({
  secureFetch: vi.fn(),
  GlobalParams: {},
}))

import { secureFetch } from "../../mcp/helpers/fetcher"
const mockSecureFetch = vi.mocked(secureFetch)

describe("Israel Statistics MCP Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getIndexTopics", () => {
    it("should fetch and transform index topics successfully", async () => {
      const mockApiResponse = {
        chapters: [
          {
            chapterId: "a",
            chapterName: "Consumer Price Index",
            chapterOrder: 1,
            mainCode: 120000,
            subject: [
              {
                subjectId: 1,
                subjectName: "General",
                code: [
                  {
                    codeId: 120010,
                    codeName: "General CPI",
                    codeNote: "Main consumer price index",
                  },
                ],
              },
            ],
          },
        ],
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getIndexTopics({
        lang: "en",
        period: "M",
        searchText: "consumer",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/catalog/tree",
        {
          format: "json",
          download: "false",
          period: "M",
          q: "consumer",
        },
        expect.any(Object), // schema
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result).toHaveProperty("topics")
      expect(result).toHaveProperty("summary")
      expect(Array.isArray(result.topics)).toBe(true)
      expect(result.topics).toEqual(mockApiResponse.chapters)
      expect(result.summary).toContain("Found 1 index codes")
    })

    it("should handle empty arguments", async () => {
      const mockApiResponse = { chapters: [] }
      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getIndexTopics()

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/catalog/tree",
        {
          format: "json",
          download: "false",
        },
        expect.any(Object),
        {
          lang: undefined,
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.topics).toEqual([])
      expect(result.summary).toContain("Found 0 index codes")
    })
  })

  describe("getCatalogChapters", () => {
    it("should fetch catalog chapters successfully", async () => {
      const mockApiResponse = {
        chapters: [
          {
            chapterId: "a",
            chapterName: "Consumer Price Index",
            chapterOrder: 1,
            mainCode: 120000,
          },
          {
            chapterId: "b",
            chapterName: "Producer Price Index",
            chapterOrder: 2,
            mainCode: 130000,
          },
        ],
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getCatalogChapters({ lang: "en" })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/catalog/catalog",
        { format: "json", download: "false" },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.chapters).toEqual(mockApiResponse.chapters)
      expect(result.summary).toBe("Found 2 index chapters.")
    })
  })

  describe("getChapterTopics", () => {
    it("should fetch chapter topics with housing warnings", async () => {
      const mockApiResponse = {
        subject: [
          {
            subjectId: 1,
            subjectName: "Housing Prices",
            code: [],
          },
        ],
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getChapterTopics({
        chapterId: "aa", // Housing chapter
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/catalog/chapter",
        { id: "aa", format: "json", download: "false" },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.topics).toEqual(mockApiResponse.subject)
      expect(result.summary).toContain("Found 1 topics in chapter aa")
      expect(result.summary).toContain("Housing Price Index") // Housing warning
    })
  })

  describe("getSubjectCodes", () => {
    it("should fetch subject codes with search filters", async () => {
      const mockApiResponse = {
        subjectId: 1,
        subjectName: "Food and Beverages",
        code: [
          {
            codeId: 120110,
            codeName: "Food",
            codeDescription: "Food products index",
            period: "Monthly",
            baseYear: "2020",
          },
        ],
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getSubjectCodes({
        subjectId: 1,
        searchText: "food",
        searchType: "contains",
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/catalog/subject",
        {
          id: "1",
          format: "json",
          download: "false",
          q: "food",
          string_match_type: "contains",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.codes).toEqual(mockApiResponse.code)
      expect(result.summary).toBe("Found 1 index codes for subject 1.")
    })
  })

  describe("getIndexData", () => {
    it("should fetch index data with date range and housing warnings", async () => {
      const mockApiResponse = {
        month: [
          {
            code: 120010,
            name: "Housing Index",
            date: [
              {
                year: 2024,
                month: 1,
                monthDesc: "January",
                percent: 2.5,
                percentYear: 5.2,
                currBase: {
                  baseDesc: "Average 2024",
                  value: 103.5,
                },
                prevBase: null,
              },
            ],
          },
        ],
        quarter: null,
        paging: {
          total_items: 1,
          page_size: 100,
          current_page: 1,
          last_page: 1,
          first_url: "http://example.com",
          previous_url: null,
          current_url: "http://example.com",
          next_url: null,
          last_url: "http://example.com",
          base_url: "http://example.com",
        },
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getIndexData({
        code: "180010",
        startPeriod: "01-2024",
        endPeriod: "03-2024",
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/data/price",
        {
          id: "180010",
          format: "json",
          download: "false",
          startPeriod: "01-2024",
          endPeriod: "03-2024",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.data).toEqual(mockApiResponse)
      expect(result.summary).toContain("Retrieved 1 data points")
      expect(result.summary).toContain("Average value: 103.50")
    })
  })

  describe("getIndexCalculator", () => {
    it("should calculate price linkage successfully", async () => {
      const mockApiResponse = {
        request: {
          code: 120010,
          sum: 100,
          currency: "NEW_SHEQEL",
          from_date: "2020-01-01",
          to_date: "2024-01-01",
        },
        answer: {
          from_value: 100,
          to_value: 115.5,
          base_year: "2022",
          from_index_date: "2020-01",
          from_index_value: 95.2,
          to_index_date: "2024-01",
          to_index_value: 110.0,
          chaining_coefficient: 1.0,
          mult_min: 1.0,
          mult_max: 1.2,
          Koeff: 1.0,
          change_percent: 15.5,
        },
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getIndexCalculator({
        indexCode: 120010,
        value: 100,
        fromDate: "01-01-2020",
        toDate: "01-01-2024",
        currency: "new_sheqel",
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/data/calculator/120010",
        {
          value: "100",
          // handler normalizes CBS-ambiguous mm-dd-yyyy input to yyyy-mm-dd
          date: "2020-01-01",
          toDate: "2024-01-01",
          format: "json",
          download: "false",
          currency: "new_sheqel",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.request).toEqual(mockApiResponse.request)
      expect(result.answer).toEqual(mockApiResponse.answer)
      expect(result.summary).toContain(
        "Linked 100 from 2020-01-01 to 2024-01-01: 115.5 (15.5% change)"
      )
    })
  })

  describe("getAllIndices", () => {
    it("should fetch all indices with chapter filter", async () => {
      const mockApiResponse = {
        indices: {
          chapter: [
            {
              name: ["Consumer Price Index"],
              month: [
                {
                  index: [
                    {
                      month: ["January"],
                      year: ["2024"],
                      code: ["120010"],
                      index_name: ["General CPI"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getAllIndices({
        chapter: "a",
        oldFormat: false,
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/data/price_all",
        {
          format: "xml",
          download: "false",
          chapter: "a",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.indices).toEqual(mockApiResponse.indices)
      expect(result.summary).toContain("Retrieved 1 indices for chapter a")
    })
  })

  describe("getMainIndices", () => {
    it("should fetch and transform main indices", async () => {
      const mockApiResponse = {
        indices: {
          UpdateDate: ["2024-01-15T10:30:00Z"],
          date: [
            {
              year: ["2024"],
              month: ["January"],
              code: [
                {
                  code: ["120010"],
                  name: ["General CPI"],
                  percent: ["2.5"],
                  index: [
                    {
                      _: "103.5",
                      base: ["Average 2024"],
                      chainingCoefficient: ["1.0"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getMainIndices({
        oldFormat: false,
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/data/price_selected",
        {
          // price_selected is XML-only — the handler requests what it serves
          format: "xml",
          download: "false",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.indices).toHaveLength(1)
      expect(result.indices[0]).toMatchObject({
        code: "120010",
        name: "General CPI",
        percent: 2.5,
        year: "2024",
        month: "January",
      })
      expect(result.indices[0].indices).toHaveLength(1)
      expect(result.indices[0].indices[0]).toMatchObject({
        value: 103.5,
        base: "Average 2024",
        chainingCoefficient: 1.0,
      })
      expect(result.updateDate).toBe("2024-01-15T10:30:00Z")
      expect(result.summary).toContain(
        "Retrieved 1 main indices updated on 2024-01-15T10:30:00Z"
      )
    })
  })

  describe("getMainIndicesByPeriod", () => {
    it("should fetch main indices by period range", async () => {
      const mockApiResponse = {
        indices: {
          ind: [
            {
              date: ["2024-01"],
              n: ["General CPI"],
              index: ["103.5"],
              percent: ["2.5"],
              code: ["120010"],
              base: ["Average 2022"],
            },
            {
              date: ["2024-02"],
              n: ["General CPI"],
              index: ["104.0"],
              percent: ["0.5"],
              code: ["120010"],
              base: ["Average 2022"],
            },
          ],
        },
      }

      mockSecureFetch.mockResolvedValue(mockApiResponse)

      const result = await getMainIndicesByPeriod({
        startDate: "202401",
        endDate: "202402",
        lang: "en",
      })

      expect(mockSecureFetch).toHaveBeenCalledWith(
        "index/data/price_selected_b",
        {
          StartDate: "202401",
          EndDate: "202402",
          format: "xml",
          download: "false",
        },
        expect.any(Object),
        {
          lang: "en",
          page: undefined,
          pagesize: undefined,
        }
      )

      expect(result.indices).toHaveLength(2)
      expect(result.indices[0]).toMatchObject({
        code: "120010",
        name: "General CPI",
        percent: 2.5,
        date: "2024-01",
        index: 103.5,
        base: "Average 2022",
      })
      expect(result.groupedByDate).toHaveProperty("2024-01")
      expect(result.groupedByDate).toHaveProperty("2024-02")
      expect(result.dateRange).toBe("202401 to 202402")
      expect(result.totalIndices).toBe(2)
      expect(result.summary).toContain(
        "Retrieved 2 main indices from 202401 to 202402"
      )
    })
  })

  describe("Error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockSecureFetch.mockRejectedValue(
        new Error("CBS API error: 500 Internal Server Error")
      )

      await expect(getIndexTopics({ lang: "en" })).rejects.toThrow(
        "CBS API error: 500 Internal Server Error"
      )

      expect(mockSecureFetch).toHaveBeenCalledTimes(1)
    })

    it("should handle network errors", async () => {
      mockSecureFetch.mockRejectedValue(new Error("Network error"))

      await expect(getCatalogChapters()).rejects.toThrow("Network error")
    })
  })

  describe("Schema validation", () => {
    it("should validate required parameters for getChapterTopics", async () => {
      const mockApiResponse = { subject: [] }
      mockSecureFetch.mockResolvedValue(mockApiResponse)

      // This should work with valid chapterId
      const result = await getChapterTopics({
        chapterId: "a",
      })

      expect(result.topics).toEqual([])
    })

    it("should validate required parameters for getSubjectCodes", async () => {
      const mockApiResponse = {
        subjectId: 1,
        subjectName: "Test Subject",
        code: [],
      }
      mockSecureFetch.mockResolvedValue(mockApiResponse)

      // This should work with valid subjectId
      const result = await getSubjectCodes({
        subjectId: 1,
      })

      expect(result.codes).toEqual([])
    })
  })
})
