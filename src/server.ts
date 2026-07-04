import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SERVER_NAME, VERSION } from "./pkg"
import { Semaphore } from "./mcp/helpers/semaphore"
import { TOOLS } from "./mcp/tools"

const MAX_CONCURRENT_OPERATIONS = 5
const MAX_QUEUED_OPERATIONS = 50

const INSTRUCTIONS = `Israeli CBS (Central Bureau of Statistics) price indices and economic data.

Discovery workflow: get_catalog_chapters (11 chapters a..fa) -> get_chapter_topics (subjects) -> get_subject_codes (index codes) -> get_index_data (time series) or get_index_calculator (inflation linkage). For keyword search across everything, start with get_index_topics instead. get_main_indices gives the current headline snapshot without any discovery.

Format rules that matter:
- Index-data periods: mm-yyyy (e.g. '01-2020'). By-period dates: yyyymm (e.g. '202001', floor 199701).
- Calculator dates: yyyy-mm-dd recommended. Never rely on dd-mm-yyyy — CBS reads mm-dd-yyyy.
- lang defaults to Hebrew; pass lang='en' for English.
- pagesize caps at 1000 (CBS limit).

Housing Market Index (chapter 'aa', codes 18xxxx) is bi-monthly and its last 3 published values are provisional; tool summaries carry a computed provisional window — trust them when linking money over recent periods.

All tools are read-only queries against the public CBS API; results include both JSON text content and structuredContent.`

/**
 * Build the MCP server with all tools registered. Capabilities are derived
 * automatically from the registrations — do NOT declare them by hand
 * (published v0.0.2 advertised phantom logging/resources capabilities and
 * broke MCP Inspector connections with -32601).
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      title: "Israel CBS Statistics",
      version: VERSION,
    },
    { instructions: INSTRUCTIONS }
  )

  const semaphore = new Semaphore(
    MAX_CONCURRENT_OPERATIONS,
    MAX_QUEUED_OPERATIONS
  )

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async (args: Record<string, unknown>) => {
        const release = await semaphore.acquire()
        try {
          const result = await tool.handler(args)
          return {
            // Text content stays byte-identical to pre-0.1.0 releases;
            // structuredContent is additive for structured-output clients.
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          }
        } finally {
          release()
        }
      }
    )
  }

  return server
}
