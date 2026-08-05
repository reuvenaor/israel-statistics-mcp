---
"@reuvenorg/israel-statistics-mcp": patch
---

Clear all dependency advisories and pin a security floor

Bumps `@modelcontextprotocol/sdk` to ^1.30.0 — required to reach the patched `@hono/node-server` 2.x, which SDK 1.29's `^1.19.9` range forbade and 1.30 widened to `^1.19.9 || ^2.0.5`. The zod v3 line is unchanged (SDK 1.30 still declares `zod: "^3.25 || ^4.0"`).

Every other advisory was a stale lockfile entry already inside a permitted range. `pnpm.overrides` now declares a minimum floor per advisory so a future re-resolution cannot silently drop back below a patch; the override-to-GHSA mapping and retirement conditions are documented in `docs/DEVELOPMENT.md`.

`pnpm audit` reports no known vulnerabilities across the full tree, down from 11 (6 high, 5 moderate). No tool names, parameters, or response shapes changed.
