# Development Guide

Technical reference for `@reuvenorg/israel-statistics-mcp` — a stdio MCP server over the Israeli CBS price-index API.

## Architecture

```
src/index.ts            entry: createServer + StdioServerTransport, graceful shutdown
src/server.ts           createServer(): registers the TOOLS table, server instructions
src/mcp/tools.ts        the 9-tool registry: name/title/description/inputSchema/outputSchema/handler
src/mcp/handlers/       one handler per tool → params → secureFetch → transform + summary
src/mcp/helpers/fetcher.ts        secureFetch: the ONLY network path
src/mcp/helpers/housingWarnings.ts period-aware housing provisional-window warnings
src/mcp/helpers/semaphore.ts      FIFO concurrency limiter (5 active / 50 queued)
src/schemas/            zod v3: request (inputs), response (CBS shapes), output (structuredContent)
src/pkg.ts              VERSION single-source (package.json) — serverInfo + User-Agent
```

## Commands

```bash
pnpm install
pnpm build            # tsup → dist/ (ESM, shebang bin)
pnpm test             # unit tests — always offline (fixtures in src/__tests__/fixtures/)
pnpm test:live        # live CBS suite (~22 cases, all 9 routes; sequential, retried)
pnpm smoke            # MCP Inspector CLI smoke, offline
node scripts/smoke.mjs --live                                  # + real CBS call per tool
node scripts/smoke.mjs --command "docker run --init --rm -i israel-statistics-mcp:dev"
pnpm lint && pnpm typecheck && pnpm format:check
npx -y @modelcontextprotocol/inspector node dist/index.js      # Inspector UI
```

## Date & period formats (the part that bites)

| Where                        | Format       | Example                  |
| ---------------------------- | ------------ | ------------------------ |
| `get_index_data` periods     | `mm-yyyy`    | `01-2020`                |
| `get_main_indices_by_period` | `yyyymm`     | `202001` (floor 199701)  |
| `get_index_calculator` dates | `yyyy-mm-dd` | `2020-01-15` (preferred) |

The CBS calculator accepts `mm-dd-yyyy` or `yyyy-mm-dd` but **silently misreads `dd-mm-yyyy`**. The server normalizes calculator dates to `yyyy-mm-dd`: ISO passes through, `mm-dd-yyyy` is honored, `dd-mm-yyyy` is auto-corrected when unambiguous (day > 12), everything else is rejected with a clear error.

## CBS API coverage

| CBS endpoint                       | Tool                         |
| ---------------------------------- | ---------------------------- |
| `GET /index/catalog/tree`          | `get_index_topics`           |
| `GET /index/catalog/catalog`       | `get_catalog_chapters`       |
| `GET /index/catalog/chapter`       | `get_chapter_topics`         |
| `GET /index/catalog/subject`       | `get_subject_codes`          |
| `GET /index/data/price`            | `get_index_data`             |
| `GET /index/data/calculator/{id}`  | `get_index_calculator`       |
| `GET /index/data/price_selected`   | `get_main_indices`           |
| `GET /index/data/price_selected_b` | `get_main_indices_by_period` |
| `GET /index/data/price_all`        | `get_all_indices`            |

Known chapters: `a` CPI · `aa` Housing Market · `b/ba/bb` Producer Prices · `c/ca` Building Inputs · `d` Road Construction · `e` Agriculture · `f/fa` Bus & Minibus Inputs. The catalog grows (CBS added `g`/`j` in 2026) — `get_catalog_chapters` is authoritative; chapter ids are validated strings, never a hardcoded enum. Full CBS reference: [INSTRUCTIONS.md](../INSTRUCTIONS.md) (Hebrew original: [INST-HEBREW.md](../INST-HEBREW.md)).

CBS realities the schemas tolerate: null coefficients (`mult_min`/`mult_max`, e.g. index 110050), inconsistent date strings (`2025-4`), empty XML containers (`<indices/>` → clean empty results), non-numeric XML values (→ typed nulls), `price_selected*`/`price_all` are XML-only, `pagesize` ≤ 1000, User-Agent mandatory, hyphenated search text can trip the CBS WAF (surfaced as a clean error).

## Security mechanisms

- Egress allowlist: `api.cbs.gov.il` over HTTPS only (asserted per request — closes `//host` URL escapes)
- 30s timeout, single retry on 5xx/network only, 15MB response cap
- zod-validated inputs everywhere; sanitized errors (endpoint path only, digested validation issues)
- Capabilities auto-derived (never declare what you don't implement — v0.0.2 broke Inspector that way)
- Supply chain: 3 runtime deps, `pnpm audit` CI gate at zero, frozen lockfile, SHA-pinned actions, digest-pinned base image, runtime image stripped of npm/npx/corepack/yarn, non-root (uid 1001)
- **Zero configured CI secrets** — publishing is done locally with web-authenticated accounts

## Testing policy

- Unit tests never touch the network (`secureFetch`/`fetch` mocked; real CBS payloads live in `src/__tests__/fixtures/`). Every bug fix ships with a unit repro.
- Live tests (`pnpm test:live`): 30s timeouts, retry 2, sequential. CBS downtime ≠ regression — check the API before blaming code. A nightly workflow runs them and opens an issue on failure.
- npx trap: `npx @reuvenorg/israel-statistics-mcp` from inside this repo resolves to the local project — test from a neutral cwd (`scripts/smoke.mjs` does).

## Releasing (all publishing is local — zero CI secrets)

1. Every user-visible change lands with a changeset (`pnpm changeset`). CI blocks PRs without one.
2. On merge to `main`, the **Version PR** workflow opens/updates the changesets "Version Packages" PR (version bump + CHANGELOG).
3. Merge that PR, then locally on updated `main`:
   ```bash
   npm login                      # browser auth, if needed
   pnpm release                   # build + changeset publish → npm + git tag
   git push --follow-tags
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t reuvenaor/israel-statistics-mcp:<version> \
     -t reuvenaor/israel-statistics-mcp:latest --push .   # Docker Desktop auth
   # after npm + Docker exist:
   mcp-publisher login github && mcp-publisher publish     # MCP Registry
   ```
4. `server.json` version is maintained in-repo — keep it equal to the released version (the `/release` skill checklist covers this).
5. Update the Docker Hub description from README via the dashboard.

Before ANY publish: run the `/release` skill — it gates on pack/publint/tarball-install smoke + local Docker build smoke.
