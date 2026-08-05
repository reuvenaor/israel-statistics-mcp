# Implemented plans

- 2026-08-05 — [Nightly live suite and correctness fixes](2026-08-05-nightly-live-suite-and-correctness-fixes.md) — the 8-night nightly failure was an unpinned MCP Inspector floating to v2 (exit 5 on `isError`), not CBS drift; also fixed silent 100-row pagination truncation, a timezone-dependent housing provisional window, quarterly series reporting "no data", and the workflow bug filing a duplicate issue every night.
- 2026-08-06 — [Clear all dependency advisories](2026-08-06-clear-all-dependency-advisories.md) — 11 audit advisories (+1 that surfaced mid-work) to zero; only `@hono/node-server` needed a real upgrade (SDK 1.30 widened the range), the rest were stale lockfile entries inside permitted ranges, now held by `pnpm.overrides` floors.
