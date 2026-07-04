import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { CbsApiError, secureFetch } from "../mcp/helpers/fetcher"

const anySchema = z.any()
const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("secureFetch — request construction", () => {
  it("sends the mandatory User-Agent and Accept headers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await secureFetch("index/catalog/catalog", { format: "json" }, anySchema)

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("https://api.cbs.gov.il/index/catalog/catalog")
    expect(init.headers["User-Agent"]).toMatch(
      /^israel-statistics-mcp\/\d+\.\d+\.\d+/
    )
    expect(init.headers.Accept).toContain("application/json")
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("clamps pagesize to the CBS maximum of 1000", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    await secureFetch("index/catalog/tree", {}, anySchema, { pagesize: 5000 })
    expect(String(fetchMock.mock.calls[0][0])).toContain("pagesize=1000")
  })

  it("refuses protocol-relative endpoints that escape the CBS host", async () => {
    await expect(
      secureFetch("//evil.example.com/steal", {}, anySchema)
    ).rejects.toThrow(/non-CBS host/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("secureFetch — retry policy", () => {
  it("retries once on 5xx and succeeds on the second attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("oops", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const result = await secureFetch("index/data/price", {}, anySchema)
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("fails with the HTTP status after exhausting retries", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }))
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /HTTP 503/
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry 4xx responses", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }))
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /HTTP 404/
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retries once on network errors", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const result = await secureFetch("index/data/price", {}, anySchema)
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry timeouts and reports them clearly", async () => {
    const timeoutError = new Error("The operation was aborted due to timeout")
    timeoutError.name = "TimeoutError"
    fetchMock.mockRejectedValue(timeoutError)
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /timed out after 30s/
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("secureFetch — response handling", () => {
  it("rejects HTML error pages with a clear message", async () => {
    fetchMock.mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>503</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    )
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /HTML page instead of data/
    )
  })

  it("rejects empty bodies", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 200 }))
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /empty response/
    )
  })

  it("surfaces CBS error payloads delivered with HTTP 200", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid index code" }))
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /CBS API returned an error: invalid index code/
    )
  })

  it("rejects malformed JSON cleanly", async () => {
    fetchMock.mockResolvedValue(
      new Response("{not json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )
    await expect(secureFetch("index/data/price", {}, anySchema)).rejects.toThrow(
      /malformed JSON/
    )
  })

  it("parses XML bodies with xml2js array conventions", async () => {
    fetchMock.mockResolvedValue(
      new Response("<indices><ind><code>120010</code></ind></indices>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      })
    )
    const schema = z.object({
      indices: z.object({ ind: z.array(z.object({ code: z.array(z.string()) })) }),
    })
    const result = await secureFetch("index/data/price_selected_b", {}, schema)
    expect(result.indices.ind[0].code[0]).toBe("120010")
  })

  it("rejects oversized responses", async () => {
    fetchMock.mockResolvedValue(
      new Response("x", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(20 * 1024 * 1024),
        },
      })
    )
    await expect(secureFetch("index/data/price_all", {}, anySchema)).rejects.toThrow(
      /too large/
    )
  })
})

describe("secureFetch — error hygiene", () => {
  it("digests zod validation failures instead of dumping raw ZodError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: "not-a-number" }))
    const schema = z.object({ a: z.number() })
    const err = await secureFetch("index/data/price", {}, schema).catch((e) => e)
    expect(err).toBeInstanceOf(CbsApiError)
    expect(err.message).toContain("validation failed")
    expect(err.message).toContain("a:")
    // raw ZodError serialization markers must not leak
    expect(err.message).not.toContain('"code"')
    expect(err.message).not.toContain("invalid_type")
  })

  it("never includes query-string values in error messages", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 400 }))
    const err = await secureFetch(
      "index/data/price",
      { id: "120010", secretish: "value-that-must-not-leak" },
      anySchema
    ).catch((e) => e)
    expect(err).toBeInstanceOf(CbsApiError)
    expect(err.message).not.toContain("value-that-must-not-leak")
    expect(err.message).not.toContain("120010")
    expect(err.endpoint).toBe("index/data/price")
  })
})
