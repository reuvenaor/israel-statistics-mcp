---
paths:
  - "src/**"
---

# MCP server conventions (this repo)

- **stdout = JSON-RPC only.** Log exclusively with `console.error`. Any stray stdout corrupts the protocol.
- zod imports: `import { z } from "zod"` — v3 API only (SDK 1.x constraint). No `zod/v4`, no zod 4 idioms.
- Tools are defined ONLY in the `TOOLS` table (`src/mcp/tools.ts`) and registered by the loop in `src/server.ts`. Never call `server.registerTool` elsewhere.
- Every tool: `title`, rich `description` (embed CBS domain guidance — date formats, discovery workflow, caveats), `inputSchema`/`outputSchema` as zod raw shapes, `annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true }` (all tools are read-only views of a public remote API).
- Handlers return plain data objects with a human `summary` string; the registration wrapper produces both `content` (JSON.stringify text — byte-stable for old clients) and `structuredContent`.
- Do NOT add a hand-written `capabilities` object to `new McpServer(...)` — auto-derived. Declaring unimplemented capabilities breaks clients (verified: Inspector -32601 on v0.0.2).
- Concurrency: handlers run under the FIFO semaphore (5 active / 50 queued) via the wrapper — don't add per-handler throttling.
- Backward compat: tool names, param names/types, and existing response top-level keys are frozen; changes must be additive. Version comes from `src/pkg.ts`.
- Every bug fix ships with a unit test reproducing it (fixtures in `src/__tests__/fixtures/`).
