# Security Policy

## Supported versions

Only the latest published version receives security fixes.

## Scope

This is a **read-only stdio MCP server** over the public, unauthenticated CBS
statistics API (`api.cbs.gov.il`). It handles no credentials, no user data,
and no secrets. The primary security surfaces are:

- input handling of tool arguments (zod-validated, bounded, regex-checked)
- outbound requests (HTTPS-only, host-allowlisted to `api.cbs.gov.il`,
  30s timeout, 15MB response cap, mandatory User-Agent)
- response parsing (content-type aware; HTML/error payloads rejected cleanly;
  no raw parser/validation internals surfaced to clients)
- supply chain (3 runtime deps, `pnpm audit` CI gate, frozen lockfile,
  SHA-pinned actions, npm provenance, SBOM'd non-root Docker images)

## Reporting a vulnerability

Please use **GitHub Private Vulnerability Reporting** on
[reuvenaor/israel-statistics-mcp](https://github.com/reuvenaor/israel-statistics-mcp/security/advisories/new).
If that is unavailable, open a minimal public issue asking for a private
channel — do not include exploit details in public issues.

- Acknowledgement target: within 7 days
- Coordinated disclosure: 90 days, or earlier once a fix is released
