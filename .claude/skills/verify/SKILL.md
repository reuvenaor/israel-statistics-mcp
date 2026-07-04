---
name: verify
description: Verify the MCP server end-to-end after code changes — build, Inspector smoke (9 tools), unit tests, and the calculator regression case. Use after any change under src/ or before committing.
allowed-tools: Bash(pnpm build), Bash(pnpm test), Bash(pnpm test:*), Bash(pnpm typecheck), Bash(pnpm lint), Bash(node scripts/smoke.mjs:*), Bash(npx @modelcontextprotocol/inspector:*), Bash(npx -y @modelcontextprotocol/inspector:*), Read, Grep
---

# Verify the MCP server

Run these in order; stop and report at the first failure.

1. **Static gates**: `pnpm typecheck && pnpm lint`
2. **Unit tests (offline)**: `pnpm test` — must pass with no network.
3. **Build**: `pnpm build` — confirm `dist/index.js` exists and starts with `#!/usr/bin/env node`.
4. **Offline smoke**: `node scripts/smoke.mjs`
   - Asserts: Inspector CLI connects (a connect failure usually means a capabilities regression — see CLAUDE.md), `tools/list` returns exactly **9** tools, an invalid-args `tools/call` returns a clean error (no raw ZodError dump), stdout stayed protocol-clean.
5. **Live spot-check** (only if the change touches fetcher/schemas/handlers and network is OK):
   `node scripts/smoke.mjs --live` — includes the **110050 null-coefficient regression** (must succeed) and 120010 happy path.
6. Report a pass/fail matrix per step. For live failures, distinguish CBS-side outage (5xx/timeouts across ALL tools) from a real regression (single tool/schema failure) before blaming the change.

The built server is also wired in `.mcp.json` as `israel-statistics` — for a final human-level check, call one tool through the MCP connection (e.g. `get_catalog_chapters {lang:"en"}`) and confirm both `content` text and `structuredContent` are present.
