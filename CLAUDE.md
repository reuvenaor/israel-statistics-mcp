# israel-statistics-mcp

Stdio **MCP server** exposing Israeli CBS (Central Bureau of Statistics) price indices: 9 read-only tools for catalog discovery, index data, main indices, and inflation-linkage calculation. Published to npm (`@reuvenorg/israel-statistics-mcp`), Docker Hub (`reuvenaor/israel-statistics-mcp`), and the official MCP Registry (`io.github.reuvenaor/israel-statistics-mcp`).

## Commands

```bash
pnpm build            # tsup → dist/ (ESM, shebang bin)
pnpm typecheck        # tsc --noEmit
pnpm test             # unit tests ONLY — always offline (prepublishOnly runs this)
pnpm test:live        # live CBS API suite (opt-in; slow; needs network)
pnpm lint / lint:fix  # eslint flat config
pnpm format:write     # prettier
pnpm smoke            # scripts/smoke.mjs — Inspector CLI offline smoke (tools/list = 9)
node scripts/smoke.mjs --live       # smoke with real CBS tool calls
node scripts/smoke.mjs --command "docker run --rm -i israel-statistics-mcp:dev"  # smoke any spawn form
```

## Architecture

```
src/index.ts            entry: shebang, createServer + StdioServerTransport, graceful shutdown
src/server.ts           createServer(): registers TOOLS table, server instructions
src/mcp/tools.ts        the 9-tool table: name/title/description/inputSchema/outputSchema/handler
src/mcp/handlers/       one handler per tool → builds params → secureFetch → transform + summary
src/mcp/helpers/fetcher.ts    secureFetch: the ONLY network path (timeout/UA/retry/host allowlist)
src/mcp/helpers/housingWarnings.ts  bi-monthly housing provisional-window warnings
src/mcp/helpers/semaphore.ts  FIFO concurrency limiter (5 concurrent, 50 queued)
src/schemas/            zod v3: request (inputs), response (CBS shapes), output (structuredContent)
src/pkg.ts              VERSION single-source (package.json) — used by serverInfo + User-Agent
```

## Hard constraints (violating these breaks users)

- **stdio protocol: stdout is JSON-RPC only.** All logging via `console.error` (stderr). Never `console.log`.
- **SDK 1.x ⇒ zod v3 line only** (`zod ^3.25.76`). zod 4 breaks the SDK — do not upgrade until we migrate to SDK v2 (GA).
- **Never declare MCP capabilities without handlers.** McpServer auto-derives capabilities from registrations. A hand-written `capabilities:{logging:{},resources:{}}` block shipped in v0.0.2 made MCP Inspector unable to connect (`logging/setLevel` → -32601).
- **Tool names and accepted params are a published API** — additive changes only; never rename/remove/retype.
- Tool responses return **both** `content:[{type:"text", text: JSON.stringify(result)}]` and `structuredContent: result`. Output schemas are validated by the SDK on every call — keep them tolerant of CBS variance (nullable numerics, loose date strings).
- Server version comes from `src/pkg.ts` (package.json) — never hardcode.

## CBS API gotchas

Authoritative endpoint reference: @INSTRUCTIONS.md (English translation of the CBS API spec; `INST-HEBREW.md` is the original). Key traps:

- **User-Agent header is mandatory** (CBS requirement) — `secureFetch` always sends it.
- **Calculator dates**: CBS accepts `mm-dd-yyyy` or `yyyy-mm-dd`, **never `dd-mm-yyyy`** — we normalize all inputs to `yyyy-mm-dd` before sending; keep it that way (silent misparse = wrong financial results).
- **XML-only endpoints**: `price_selected`, `price_selected_b` (dates `yyyymm`, min `199701`), `price_all`. The rest are JSON. `pagesize` cap is 1000.
- CBS returns **null coefficients** for some series (e.g. index 110050) and inconsistent date strings (`2019-11` vs `2025-4`) — response schemas must stay nullable/tolerant.
- Housing Price Index (chapter `aa`, codes `18xxxx`): bi-monthly, last 3 published values are provisional — `housingWarnings.ts` computes the current provisional window and appends warnings to summaries.
- Empty XML result sets arrive as `<indices/>` → schemas preprocess `""` → empty arrays (must return "0 results", never a validation error).

## Testing policy

- Unit tests (`src/__tests__/unit/`) never touch the network — `secureFetch` or `globalThis.fetch` is mocked. Every bug fix lands with a unit repro. Real CBS payloads live in `src/__tests__/fixtures/`.
- Live tests (`src/__tests__/live/`) run only via `pnpm test:live` (30s timeouts, retry, sequential). CBS downtime ≠ regression — check https://api.cbs.gov.il availability before blaming code.
- **npx testing trap**: `npx @reuvenorg/israel-statistics-mcp` run from inside this repo resolves to the local project, not the registry — test npx spawns from a neutral cwd (smoke.mjs handles this).
- The built server is self-wired in `.mcp.json` as `israel-statistics` — after `pnpm build` you can call its tools live in a Claude Code session.

## Release

- **Changesets only** — never `npm publish` by hand. One changeset per user-visible change-group. `release.yml` is the single publish path (npm + provenance → Docker buildx → MCP Registry).
- **Before any publish**: `pnpm pack` + `publint` and inspect the tarball (dist/ + README + LICENSE, shebang, both bins); build the local Docker image and smoke it (`docker build -t israel-statistics-mcp:dev .`).
- `server.json` version is CI-patched from package.json — don't edit versions by hand. Keep the README tool table (9 tools) and `server.json` in sync with `src/mcp/tools.ts`.
- Node engines `>=20`; pnpm version pinned via `packageManager`.
