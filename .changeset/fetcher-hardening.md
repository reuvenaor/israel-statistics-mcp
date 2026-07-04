---
"@reuvenorg/israel-statistics-mcp": patch
---

Network hardening: 30s request timeout, mandatory User-Agent (a CBS API
requirement), single retry on 5xx/network errors, 15MB response cap, HTTPS
host allowlist pinned to api.cbs.gov.il, content-type-aware parsing that
rejects HTML error pages and CBS 200-with-error payloads cleanly, and
sanitized error messages (endpoint path only, digested validation issues —
never raw ZodError JSON). node-fetch replaced by the Node built-in fetch.
