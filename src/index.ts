import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SERVER_NAME, VERSION } from "./pkg"
import { TOOLS } from "./mcp/tools"
import { createServer } from "./server"

async function main() {
  console.error(`[MCP] Starting ${SERVER_NAME} v${VERSION}...`)

  const server = createServer()
  console.error(`[MCP] Registered ${TOOLS.length} tools`)

  const shutdown = async (signal: string) => {
    console.error(`[MCP] Received ${signal}, shutting down...`)
    try {
      await server.close()
    } catch {
      // best-effort close on shutdown
    }
    process.exit(0)
  }
  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[MCP] Server ready on stdio")
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error)
  process.exit(1)
})
