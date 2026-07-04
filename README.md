# Israel Statistics MCP

[![CI](https://github.com/reuvenaor/israel-statistics-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/reuvenaor/israel-statistics-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40reuvenorg%2Fisrael-statistics-mcp)](https://www.npmjs.com/package/@reuvenorg/israel-statistics-mcp)
[![Docker](https://img.shields.io/docker/v/reuvenaor/israel-statistics-mcp?label=docker)](https://hub.docker.com/r/reuvenaor/israel-statistics-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Ask your AI assistant about Israeli inflation, prices, and housing data — straight from the official Central Bureau of Statistics (CBS).**

Once installed, Claude (or any MCP-enabled assistant) can look up price indices, chart historical trends, and run the official CBS inflation calculator for you. No API key needed — the CBS data is free and public.

## Install

### Claude Desktop

Add this to your `claude_desktop_config.json` (Settings → Developer → Edit Config), then restart Claude:

```json
{
  "mcpServers": {
    "israel-statistics": {
      "command": "npx",
      "args": ["-y", "@reuvenorg/israel-statistics-mcp"]
    }
  }
}
```

### Claude Code

One command in your terminal:

```bash
claude mcp add israel-statistics -- npx -y @reuvenorg/israel-statistics-mcp
```

### Any other MCP client

Use the same `npx` command and args as above — that's all a client needs.

### Prefer Docker?

```json
{
  "mcpServers": {
    "israel-statistics": {
      "command": "docker",
      "args": [
        "run",
        "--init",
        "--rm",
        "-i",
        "reuvenaor/israel-statistics-mcp:latest"
      ]
    }
  }
}
```

## What can I ask?

Just talk to your assistant naturally:

- _"How much is 1,000 ₪ from January 2015 worth today?"_
- _"What's the latest Israeli inflation number?"_
- _"Show me housing price trends from 2020 to 2024."_
- _"Which price indices exist for food? Compare bread vs. fresh vegetables."_
- _"Link my 2018 rent of 4,500 ₪ to today using the CPI."_

Answers come in Hebrew by default (it's the CBS default) — just ask in English to get English.

## What's inside

9 read-only tools your assistant uses behind the scenes:

| Tool                         | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `get_index_topics`           | Search all price-index topics by keyword            |
| `get_catalog_chapters`       | List the index categories (CPI, housing, …)         |
| `get_chapter_topics`         | Topics inside one category                          |
| `get_subject_codes`          | The concrete index codes for a topic                |
| `get_index_data`             | Historical values for one index                     |
| `get_index_calculator`       | Official CBS inflation adjustment between two dates |
| `get_main_indices`           | Today's headline indices                            |
| `get_main_indices_by_period` | Headline indices over a month range                 |
| `get_all_indices`            | The full current-month index tree                   |

## Good to know

- **Housing data** updates every two months, and the last three published values are provisional — the server warns automatically when recent housing numbers may still change.
- **History depth varies** — the general CPI goes back decades; the headline month-range view starts at January 1997.
- **It's read-only and free** — the server only reads public CBS data over HTTPS (`api.cbs.gov.il`) and talks to nothing else. No account, no key, no tracking.

## For developers

Architecture, testing, CBS API details, security notes, and the release process live in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Vulnerability reports: [SECURITY.md](SECURITY.md).

## Links

- **npm**: [@reuvenorg/israel-statistics-mcp](https://www.npmjs.com/package/@reuvenorg/israel-statistics-mcp) · **Docker**: [reuvenaor/israel-statistics-mcp](https://hub.docker.com/r/reuvenaor/israel-statistics-mcp) · **MCP Registry**: `io.github.reuvenaor/israel-statistics-mcp`
- **Data source**: [Israel Central Bureau of Statistics](https://www.cbs.gov.il/) · [Model Context Protocol](https://modelcontextprotocol.io/)

MIT License — see [LICENSE](LICENSE).
