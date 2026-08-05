# @reuvenorg/israel-statistics-mcp

## 1.1.0

### Minor Changes

- d718457: Fix silent data truncation, a housing-window timing bug, and quarterly series reporting

  - **`get_index_data` no longer silently truncates long ranges.** CBS defaults `pagesize` to 100, so a 25-year request returned 100 of 300 points and the summary reported that partial mean as if it covered the whole range. The tool now requests CBS's maximum page size when the caller does not paginate, and states page/total explicitly if CBS still reports more. `get_subject_codes` gets the same default — its response schema strips `paging`, so truncation there left no trace at all.
  - **Housing provisional-window warnings are correct in every timezone.** The window boundary was a day early (`>= 15` where CBS's rule makes the 15th's publication current only _after_ the 15th), and the day was read from the host clock rather than Israel time. On a UTC+13 host those combined to declare a still-provisional period "final" — the exact unsafe linkage the warning exists to prevent.
  - **Quarterly index codes report their data.** `month` is null for quarterly series and the values live in `quarter`, which no handler read, so quarterly codes answered "No data points found" while holding the full series.
  - Server instructions no longer claim there are 11 chapters `a..fa`; CBS publishes 14 today and the list grows.

### Patch Changes

- 44a936a: Clear all dependency advisories and pin a security floor

  Bumps `@modelcontextprotocol/sdk` to ^1.30.0 — required to reach the patched `@hono/node-server` 2.x, which SDK 1.29's `^1.19.9` range forbade and 1.30 widened to `^1.19.9 || ^2.0.5`. The zod v3 line is unchanged (SDK 1.30 still declares `zod: "^3.25 || ^4.0"`).

  Every other advisory was a stale lockfile entry already inside a permitted range. `pnpm.overrides` now declares a minimum floor per advisory so a future re-resolution cannot silently drop back below a patch; the override-to-GHSA mapping and retirement conditions are documented in `docs/DEVELOPMENT.md`.

  `pnpm audit` reports no known vulnerabilities across the full tree, down from 11 (6 high, 5 moderate). No tool names, parameters, or response shapes changed.

## 1.0.0

### Major Changes

- c82c165: 1.0.0: MCP SDK 1.29 and a modern tool surface. Every tool now has a title, read-only
  annotations, a typed output schema, and returns `structuredContent` alongside
  the (unchanged) JSON text content. The server no longer advertises phantom
  `logging`/`resources` capabilities — published 0.0.2 returned -32601 to
  `logging/setLevel`, which made MCP Inspector unable to connect at all. Server
  version now reports the real package version, tool descriptions embed CBS
  usage guidance, concurrency bursts queue (FIFO, 5 active / 50 queued) instead
  of hard-failing, and shutdown is graceful. Requires Node >= 20.

### Patch Changes

- c82c165: Calculator fixes: series that return null coefficient bounds (e.g. index 110050) now succeed instead of failing with a raw validation dump, and the
  summary derives the percent change when CBS omits it. Calculator dates are
  normalized to unambiguous `yyyy-mm-dd` before reaching CBS — Israeli-style
  `dd-mm-yyyy` input was previously misread by CBS as mm-dd, silently producing
  wrong linkage results; it is now auto-corrected when unambiguous (day > 12)
  and rejected with a clear message otherwise.
- c82c165: Network hardening: 30s request timeout, mandatory User-Agent (a CBS API
  requirement), single retry on 5xx/network errors, 15MB response cap, HTTPS
  host allowlist pinned to api.cbs.gov.il, content-type-aware parsing that
  rejects HTML error pages and CBS 200-with-error payloads cleanly, and
  sanitized error messages (endpoint path only, digested validation issues —
  never raw ZodError JSON). node-fetch replaced by the Node built-in fetch.
- c82c165: Schema resilience against real CBS behavior: empty XML result sets return
  clean zero-result summaries instead of validation errors; non-numeric XML
  values become typed nulls instead of NaN; chapter ids accept the growing CBS
  catalog (new g/j chapters) instead of a hardcoded 11-value enum; numeric-
  looking string params (code, startDate, endDate) accept numbers too;
  `coef=true` actually returns linkage coefficients now; housing warnings fire
  for 18xxxx codes and Hebrew names and carry a computed provisional window
  instead of static text. The unused `format` parameter of get_index_data was
  removed (ignored if sent). Dead dependencies removed — the published package
  drops 9 unused runtime deps; `pnpm audit` is clean (0 vulnerabilities).
