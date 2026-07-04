# Israel Statistics MCP Server

[![CI](https://github.com/reuvenaor/israel-statistics-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/reuvenaor/israel-statistics-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40reuvenorg%2Fisrael-statistics-mcp)](https://www.npmjs.com/package/@reuvenorg/israel-statistics-mcp)
[![Docker](https://img.shields.io/docker/v/reuvenaor/israel-statistics-mcp?label=docker)](https://hub.docker.com/r/reuvenaor/israel-statistics-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **Model Context Protocol (MCP) server** for the Israeli Central Bureau of Statistics (CBS) price indices and economic data: **9 read-only tools** for catalog discovery, historical index data, headline indices, and official inflation-linkage calculations.

Registered in the official MCP Registry as `io.github.reuvenaor/israel-statistics-mcp`.

## Installation

### npx

```json
// .mcp.json
{
  "mcpServers": {
    "israel-statistics": {
      "command": "npx",
      "args": ["-y", "@reuvenorg/israel-statistics-mcp"]
    }
  }
}
```

### Docker

```json
// .mcp.json
{
  "mcpServers": {
    "israel-statistics": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "reuvenaor/israel-statistics-mcp:latest"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-statistics -- npx -y @reuvenorg/israel-statistics-mcp
```

## Tools

| Tool                         | Title                      | What it does                                                             |
| ---------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `get_index_topics`           | Search Index Topics        | Search/browse the full catalog tree by keyword                           |
| `get_catalog_chapters`       | List Index Chapters        | Authoritative list of index chapters (CPI, housing, producer, …)         |
| `get_chapter_topics`         | Get Chapter Topics         | Subjects inside one chapter                                              |
| `get_subject_codes`          | Get Subject Index Codes    | Concrete index codes for a subject                                       |
| `get_index_data`             | Get Index Time Series      | Historical series for one code (ranges, `last=N`, linkage coefficients)  |
| `get_index_calculator`       | Calculate Price Linkage    | Official CBS inflation adjustment between two dates                      |
| `get_main_indices`           | Get Main Indices Snapshot  | Current headline indices                                                 |
| `get_main_indices_by_period` | Get Main Indices by Period | Headline indices over a month range, grouped by month                    |
| `get_all_indices`            | Get All Current Indices    | Complete current-month tree, optionally filtered by chapter              |

Every tool ships a `title`, `readOnlyHint`/`openWorldHint`/`idempotentHint` annotations, a typed `outputSchema`, and returns **both** JSON text content and `structuredContent`.

### Discovery workflow

`get_catalog_chapters` → `get_chapter_topics` → `get_subject_codes` → `get_index_data` / `get_index_calculator` — or start from a keyword with `get_index_topics`. `get_main_indices` needs no discovery at all.

## Date formats (important)

| Where                         | Format       | Example                  |
| ----------------------------- | ------------ | ------------------------ |
| `get_index_data` periods      | `mm-yyyy`    | `01-2020`                |
| `get_main_indices_by_period`  | `yyyymm`     | `202001` (floor 199701)  |
| `get_index_calculator` dates  | `yyyy-mm-dd` | `2020-01-15` (preferred) |

The CBS calculator accepts `mm-dd-yyyy` or `yyyy-mm-dd` but silently misreads `dd-mm-yyyy`. This server **normalizes calculator dates to `yyyy-mm-dd`** before calling CBS: ISO input passes through, `mm-dd-yyyy` is honored, and `dd-mm-yyyy` is auto-corrected when unambiguous (day > 12); everything else is rejected with a clear error — never a silently wrong financial result.

## Housing Price Index caveats

The Housing Market chapter (`aa`, codes `18xxxx`) is **bi-monthly** and its **last 3 published values are provisional** (they get revised as late transaction reports arrive). Housing-related responses append a computed provisional window to the summary — e.g. a linkage whose `toDate` falls inside the window is flagged, while requests for older periods are marked final.

## Example: inflation linkage

```jsonc
// get_index_calculator
{ "indexCode": 120010, "value": 1000, "fromDate": "2020-01-01", "toDate": "2025-06-01", "lang": "en" }

// → structuredContent
{
  "request": { "code": 120010, "sum": 1000, "from_date": "2020-01-01", "to_date": "2025-06-01", "currency": "NEW_SHEQEL" },
  "answer": { "from_value": 1000, "to_value": 1166.81, "change_percent": 16.7, "base_year": "Average 2018", /* … */ },
  "summary": "Linked 1000 from 2020-01-01 to 2025-06-01: 1166.81 (16.7% change)"
}
```

Some series legitimately return `null` coefficient bounds (`mult_min`/`mult_max`, e.g. index 110050) — handled, not an error.

## CBS API coverage

| CBS endpoint                        | Tool                                        |
| ----------------------------------- | ------------------------------------------- |
| `GET /index/catalog/tree`           | `get_index_topics`                          |
| `GET /index/catalog/catalog`        | `get_catalog_chapters`                      |
| `GET /index/catalog/chapter`        | `get_chapter_topics`                        |
| `GET /index/catalog/subject`        | `get_subject_codes`                         |
| `GET /index/data/price`             | `get_index_data`                            |
| `GET /index/data/calculator/{id}`   | `get_index_calculator`                      |
| `GET /index/data/price_selected`    | `get_main_indices`                          |
| `GET /index/data/price_selected_b`  | `get_main_indices_by_period`                |
| `GET /index/data/price_all`         | `get_all_indices`                           |

Known chapters: `a` CPI · `aa` Housing Market · `b/ba/bb` Producer Prices · `c/ca` Building Inputs · `d` Road Construction · `e` Agriculture · `f/fa` Bus & Minibus Inputs — the catalog grows over time (CBS added `g`/`j` in 2026), so `get_catalog_chapters` is authoritative. Hebrew is the default response language; pass `lang: "en"` for English. Full CBS API reference: [INSTRUCTIONS.md](INSTRUCTIONS.md).

## Security

- **Egress allowlist** — the server talks to `api.cbs.gov.il` over HTTPS and nothing else (asserted per request).
- **Request hygiene** — 30s timeout, single retry on 5xx/network only, 15MB response cap, mandatory User-Agent (CBS requirement).
- **Input validation** — every parameter is zod-validated (date/period regexes, positive amounts, bounded pagination).
- **Sanitized errors** — CBS/HTML/parsing failures surface as concise messages with the endpoint path only; no query strings, no raw validation dumps.
- **Honest capabilities** — the server advertises exactly what it implements (tools only).
- **Supply chain** — 3 runtime dependencies, `pnpm audit` gate in CI (zero known vulnerabilities), frozen lockfile, SHA-pinned actions, npm provenance, multi-arch Docker images with SBOM + provenance, non-root container (uid 1001), digest-pinned base image.

Vulnerability reports: see [SECURITY.md](SECURITY.md).

## Development

```bash
pnpm install
pnpm build            # tsup → dist/
pnpm test             # unit tests (offline, fixture-driven)
pnpm test:live        # live CBS API suite (~22 cases, all 9 routes)
pnpm smoke            # MCP Inspector CLI smoke (offline)
node scripts/smoke.mjs --live               # smoke with real CBS calls
node scripts/smoke.mjs --command "docker run --rm -i israel-statistics-mcp:dev"
pnpm lint && pnpm typecheck && pnpm format:check
```

Debug interactively with the MCP Inspector UI:

```bash
pnpm build && npx -y @modelcontextprotocol/inspector node dist/index.js
```

Requirements: Node ≥ 20, pnpm (version pinned via `packageManager`).

### Releasing

Releases go through [changesets](https://github.com/changesets/changesets): every user-visible change lands with a changeset; merging the release PR publishes to npm (with provenance), Docker Hub (multi-arch), and the MCP Registry — after lint/typecheck/tests/build and a live CBS smoke gate.

## License

MIT — see [LICENSE](LICENSE).

## Links

- **MCP Registry**: `io.github.reuvenaor/israel-statistics-mcp`
- **npm**: [@reuvenorg/israel-statistics-mcp](https://www.npmjs.com/package/@reuvenorg/israel-statistics-mcp)
- **Docker Hub**: [reuvenaor/israel-statistics-mcp](https://hub.docker.com/r/reuvenaor/israel-statistics-mcp)
- **CBS API**: [api.cbs.gov.il](https://api.cbs.gov.il/) · [CBS API interface docs](https://www.cbs.gov.il/en/cbsNewBrand/Pages/API-interface.aspx)
- **MCP**: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
