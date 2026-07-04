import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

vi.mock("../../mcp/helpers/fetcher", () => ({
  secureFetch: vi.fn(),
  GlobalParams: {},
}))

import { secureFetch } from "../../mcp/helpers/fetcher"
import { createServer } from "../../server"
import { Semaphore } from "../../mcp/helpers/semaphore"
const mockSecureFetch = vi.mocked(secureFetch)

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")
  )
}

describe("MCP server (InMemoryTransport round-trip)", () => {
  let client: Client

  beforeEach(async () => {
    vi.clearAllMocks()
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    const server = createServer()
    await server.connect(serverTransport)
    client = new Client({ name: "test-client", version: "0.0.0" })
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    await client.close()
  })

  it("does NOT advertise phantom capabilities (v0.0.2 Inspector-breaking bug)", () => {
    const capabilities = client.getServerCapabilities()
    expect(capabilities?.tools).toBeDefined()
    // Declaring these without handlers returned -32601 to logging/setLevel
    // and resources/list, which aborts MCP Inspector connections.
    expect(capabilities?.logging).toBeUndefined()
    expect(capabilities?.resources).toBeUndefined()
    expect(capabilities?.prompts).toBeUndefined()
  })

  it("reports the real package version from package.json", async () => {
    const { VERSION } = await import("../../pkg")
    const serverVersion = client.getServerVersion()
    expect(serverVersion?.name).toBe("israel-statistics-mcp")
    // v0.0.2 hardcoded "1.0.0" while npm said 0.0.2 — the server must
    // always report the actual package version, whatever it is.
    expect(serverVersion?.version).toBe(VERSION)
  })

  it("lists exactly 9 tools, each with title, annotations, and schemas", async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_all_indices",
      "get_catalog_chapters",
      "get_chapter_topics",
      "get_index_calculator",
      "get_index_data",
      "get_index_topics",
      "get_main_indices",
      "get_main_indices_by_period",
      "get_subject_codes",
    ])
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy()
      expect(tool.description?.length ?? 0, tool.name).toBeGreaterThan(40)
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true)
      expect(tool.annotations?.openWorldHint, tool.name).toBe(true)
      expect(tool.inputSchema, tool.name).toBeDefined()
      expect(tool.outputSchema, tool.name).toBeDefined()
    }
  })

  it("returns matching text content and structuredContent", async () => {
    mockSecureFetch.mockResolvedValue({
      chapters: [
        {
          chapterId: "a",
          chapterName: "Consumer Price Index",
          chapterOrder: 1,
          mainCode: 120010,
        },
      ],
    })
    const result = await client.callTool({
      name: "get_catalog_chapters",
      arguments: { lang: "en" },
    })
    expect(result.isError).toBeFalsy()
    const content = result.content as Array<{ type: string; text: string }>
    expect(content[0].type).toBe("text")
    const parsedText = JSON.parse(content[0].text)
    expect(result.structuredContent).toEqual(parsedText)
    expect(parsedText.summary).toContain("1 index chapters")
  })

  it("replays the 110050 null-coefficient fixture through the full stack", async () => {
    mockSecureFetch.mockResolvedValue(
      fixture("calculator-110050-null-coeffs.json")
    )
    const result = await client.callTool({
      name: "get_index_calculator",
      arguments: {
        indexCode: 110050,
        value: 1000,
        fromDate: "2020-01-01",
        toDate: "2025-06-01",
      },
    })
    expect(result.isError).toBeFalsy()
    const structured = result.structuredContent as {
      answer: { mult_min: number | null; to_value: number }
      summary: string
    }
    expect(structured.answer.mult_min).toBeNull()
    expect(structured.answer.to_value).toBeCloseTo(1193.05)
    expect(structured.summary).toContain("19.3% change")
  })

  it("rejects invalid arguments before any network call", async () => {
    const result = await client.callTool({
      name: "get_index_data",
      arguments: { code: "120010", startPeriod: "13-2020" },
    })
    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type: string; text: string }>
    expect(content[0].text).toContain("startPeriod must be mm-yyyy")
    expect(mockSecureFetch).not.toHaveBeenCalled()
  })

  it("surfaces handler errors as clean isError results, not raw dumps", async () => {
    const { CbsApiError } = await vi.importActual<
      typeof import("../../mcp/helpers/fetcher")
    >("../../mcp/helpers/fetcher")
    mockSecureFetch.mockRejectedValue(
      new CbsApiError("CBS API request timed out after 30s", "index/data/price")
    )
    const result = await client.callTool({
      name: "get_index_data",
      arguments: { code: "120010" },
    })
    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type: string; text: string }>
    expect(content[0].text).toContain("timed out")
    expect(content[0].text).not.toContain('"code":')
  })
})

describe("Semaphore", () => {
  it("caps concurrency and queues in FIFO order", async () => {
    const semaphore = new Semaphore(2, 10)
    const order: number[] = []
    const releases: Array<() => void> = []

    releases.push(await semaphore.acquire())
    releases.push(await semaphore.acquire())
    expect(semaphore.activeCount).toBe(2)

    const third = semaphore.acquire().then((release) => {
      order.push(3)
      releases.push(release)
    })
    const fourth = semaphore.acquire().then((release) => {
      order.push(4)
      releases.push(release)
    })
    expect(semaphore.queuedCount).toBe(2)

    releases[0]()
    await third
    releases[1]()
    await fourth
    expect(order).toEqual([3, 4])
  })

  it("rejects when the queue overflows", async () => {
    const semaphore = new Semaphore(1, 1)
    await semaphore.acquire()
    void semaphore.acquire() // fills the queue
    await expect(semaphore.acquire()).rejects.toThrow(/Server busy/)
  })

  it("release is idempotent", async () => {
    const semaphore = new Semaphore(1, 5)
    const release = await semaphore.acquire()
    release()
    release()
    expect(semaphore.activeCount).toBe(0)
  })
})
