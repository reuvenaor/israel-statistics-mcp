import { z } from "zod"
import xml2js from "xml2js"
import { REPO_URL, SERVER_NAME, VERSION } from "../../pkg"

const API_BASE = "https://api.cbs.gov.il/"
// Egress allowlist: this server talks to the CBS API host and nothing else.
const ALLOWED_HOST = "api.cbs.gov.il"
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 15 * 1024 * 1024
const MAX_RETRIES = 1
const RETRY_BASE_DELAY_MS = 500
// CBS requires a User-Agent header on all API requests.
const USER_AGENT = `${SERVER_NAME}/${VERSION} (+${REPO_URL})`
const ACCEPT =
  "application/json, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1"

export interface GlobalParams {
  lang?: "he" | "en"
  page?: number
  pagesize?: number
}

/**
 * Error surfaced to MCP clients. Carries the endpoint path only — never the
 * query string — so tool errors stay concise and leak nothing.
 */
export class CbsApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = "CbsApiError"
  }
}

function isTimeoutError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  )
}

function looksLikeHtml(text: string): boolean {
  const head = text.trimStart().slice(0, 100).toLowerCase()
  return head.startsWith("<!doctype html") || head.startsWith("<html")
}

function looksLikeXml(text: string): boolean {
  const head = text.trimStart()
  return head.startsWith("<?xml") || head.startsWith("<")
}

function parseXml(text: string): Promise<unknown> {
  const parser = new xml2js.Parser({
    explicitArray: true, // Always arrays so single elements parse consistently
    ignoreAttrs: false,
    mergeAttrs: true,
  })
  return parser.parseStringPromise(text)
}

/**
 * CBS occasionally returns HTTP 200 with an error payload instead of data.
 * Detect the common shapes conservatively (explicit error keys only).
 */
function extractCbsError(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload))
    return null
  const obj = payload as Record<string, unknown>
  for (const key of ["error", "Error", "error_message", "Message"]) {
    const value = obj[key]
    if (typeof value === "string" && value.length > 0) return value
    if (value && typeof value === "object") return JSON.stringify(value)
  }
  return null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: URL,
  endpoint: string
): Promise<globalThis.Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: ACCEPT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "follow",
      })
      // Retry once on server errors; 4xx are deterministic — fail fast.
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new CbsApiError(
          `CBS API error: HTTP ${response.status}`,
          endpoint,
          response.status
        )
        await delay(RETRY_BASE_DELAY_MS + Math.random() * 250)
        continue
      }
      return response
    } catch (err) {
      if (isTimeoutError(err)) {
        // A request that already waited 30s should not wait another 30s —
        // MCP clients typically time the tool call out around 60s.
        throw new CbsApiError(
          `CBS API request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
          endpoint
        )
      }
      lastError = err
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS + Math.random() * 250)
        continue
      }
      throw new CbsApiError(
        `CBS API request failed: ${err instanceof Error ? err.message : String(err)}`,
        endpoint
      )
    }
  }
  // Unreachable, but keeps TypeScript satisfied.
  throw lastError instanceof Error
    ? lastError
    : new CbsApiError("CBS API request failed", endpoint)
}

async function parseBody(
  response: globalThis.Response,
  endpoint: string
): Promise<unknown> {
  const contentLength = response.headers.get("content-length")
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new CbsApiError(
      `CBS API response too large (${contentLength} bytes)`,
      endpoint,
      response.status
    )
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new CbsApiError(
      `CBS API response too large (${text.length} bytes)`,
      endpoint,
      response.status
    )
  }
  if (text.trim().length === 0) {
    throw new CbsApiError("CBS API returned an empty response", endpoint)
  }
  if (looksLikeHtml(text)) {
    throw new CbsApiError(
      `CBS API returned an HTML page instead of data (HTTP ${response.status}) — the API may be temporarily unavailable`,
      endpoint,
      response.status
    )
  }

  const contentType = response.headers.get("content-type") ?? ""
  const asXml =
    contentType.includes("xml") ||
    (!contentType.includes("json") && looksLikeXml(text))

  if (asXml) {
    try {
      return await parseXml(text)
    } catch (err) {
      throw new CbsApiError(
        `CBS API returned malformed XML: ${err instanceof Error ? err.message : String(err)}`,
        endpoint,
        response.status
      )
    }
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new CbsApiError(
      "CBS API returned malformed JSON",
      endpoint,
      response.status
    )
  }
}

function formatZodIssues(error: z.ZodError): string {
  const issues = error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ")
  const extra =
    error.issues.length > 8 ? ` (+${error.issues.length - 8} more)` : ""
  return issues + extra
}

export async function secureFetch<S extends z.ZodTypeAny>(
  endpoint: string,
  params: Record<string, string>,
  schema: S,
  globalParams?: GlobalParams
): Promise<z.output<S>> {
  const url = new URL(endpoint, API_BASE)
  // `new URL("//host/path", base)` swaps the host — assert after construction.
  if (url.host !== ALLOWED_HOST || url.protocol !== "https:") {
    throw new CbsApiError(
      `Refusing request to non-CBS host "${url.host}"`,
      endpoint
    )
  }

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  if (globalParams) {
    if (globalParams.lang) {
      url.searchParams.append("lang", globalParams.lang)
    }
    if (globalParams.page) {
      url.searchParams.append("page", globalParams.page.toString())
    }
    if (globalParams.pagesize) {
      // CBS caps pagesize at 1000
      const pagesize = Math.min(globalParams.pagesize, 1000)
      url.searchParams.append("pagesize", pagesize.toString())
    }
  }

  const response = await fetchWithRetry(url, endpoint)
  if (!response.ok) {
    throw new CbsApiError(
      `CBS API error: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
      endpoint,
      response.status
    )
  }

  const data = await parseBody(response, endpoint)

  const cbsError = extractCbsError(data)
  if (cbsError) {
    throw new CbsApiError(`CBS API returned an error: ${cbsError}`, endpoint)
  }

  const result = schema.safeParse(data)
  if (!result.success) {
    throw new CbsApiError(
      `CBS response validation failed for ${endpoint}: ${formatZodIssues(result.error)}`,
      endpoint
    )
  }
  return result.data
}
