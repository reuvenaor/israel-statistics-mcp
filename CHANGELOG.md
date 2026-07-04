# @reuvenorg/israel-statistics-mcp

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
