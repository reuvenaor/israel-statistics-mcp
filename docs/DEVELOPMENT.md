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

### Security overrides (`pnpm.overrides` in `package.json`)

`package.json` is JSON and cannot carry comments, so the advisory each override addresses
is recorded here. Each is a **floor** (`>=`), not a pin, so ordinary upgrades still flow.
Retire an override once every dependent's own range demands the patched version anyway —
then delete the line, run `pnpm install && pnpm audit`, and confirm it stays clean.

| Override                    | Advisory                                                                                     | Reached via              | Retire when                              |
| --------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| `fast-uri >=3.1.5`          | GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7 (host confusion via backslash authority)            | sdk → ajv                | `ajv` requires `>=3.1.5`                 |
| `ip-address >=10.3.1`       | GHSA-mwp4-54f8-5fhr, GHSA-4xrf-jv44-h6hh, GHSA-22jq-vg5j-6vgg (SSRF / trust-boundary bypass) | sdk → express-rate-limit | `express-rate-limit` requires `>=10.3.1` |
| `hono >=4.12.34`            | GHSA-8j4g-w8fx-2239 (ReDoS in CORS middleware)                                               | sdk                      | sdk requires `>=4.12.34`                 |
| `@hono/node-server >=2.0.5` | GHSA-frvp-7c67-39w9 (path traversal in serve-static on Windows)                              | sdk                      | sdk drops the `^1.19.9` alternative      |
| `postcss >=8.5.23`          | GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp (arbitrary `.map` disclosure)                       | tsup (optional peer)     | `tsup` requires `>=8.5.23`               |
| `brace-expansion >=5.0.9`   | GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 (DoS via unbounded expansion)                       | eslint → minimatch       | `minimatch` requires `>=5.0.9`           |
| `esbuild >=0.28.1`          | GHSA-g7r4-m6w7-qqqr                                                                          | tsup                     | `tsup` moves off `^0.27.0`               |

Note the last one **forces esbuild outside tsup's declared `^0.27.0` range** — no published
tsup allows the patched line, and 8.5.1 is the latest. It is dev-only (esbuild never ships;
`files` is `dist`/README/LICENSE) and the build is verified against it, but if a future tsup
upgrade misbehaves, this override is the first thing to suspect.

### Image security review (2026-08-06)

`docker scout` over the built image. What passes, and the one accepted risk:

- **npm layer: 0 vulnerabilities.** `fast-uri@4.1.2`, `ip-address@10.4.0`, `hono@4.13.0`, `@hono/node-server@2.1.0` — the overrides above reach the image.
- **Runtime surface:** uid 1001 (`appuser`), no npm/npx/corepack/yarn, no global `node_modules`; `/app` holds only `dist`, `node_modules`, `package.json` — no source, tests, lockfile, `.env` or `.git`.
- **Publishing metadata:** `io.modelcontextprotocol.server.name` equals `server.json`'s `name` (that label is what proves namespace ownership to `mcp-publisher`); version identical across `package.json`, `server.json`, both `packages[]` entries and the OCI tag.

**Accepted risk — Debian base CVEs.** The base layer carries ~45 advisories across 14 packages, including 2 critical + 2 high attributed to `perl` (5.36.0-7+deb12u3). All four are marked **"not fixed"** by Debian, and only `perl-base` is installed — which is `Essential=yes, Priority=required`, so apt refuses to remove it. Refreshing the pinned digest does not help (the newest `24-bookworm-slim` still scans 3C/8H).

Accepted because a Node stdio server never invokes perl: it is unreachable code on disk, not an exploit path. Distroless was built and tested as the alternative (works, 9 tools, smoke 3/3, 243MB vs 379MB, eliminates perl and both shells) but was **rejected** — `gcr.io/distroless/nodejs24-debian12:nonroot` ships Node <24.17.0 with 2 HIGH in the node binary itself, trading unreachable perl CVEs for a stale runtime we actually execute. Revisit if Debian issues a perl fix, or once the distroless tag catches up to Node 24.18+.

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
