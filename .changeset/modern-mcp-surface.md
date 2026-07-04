---
"@reuvenorg/israel-statistics-mcp": major
---

1.0.0: MCP SDK 1.29 and a modern tool surface. Every tool now has a title, read-only
annotations, a typed output schema, and returns `structuredContent` alongside
the (unchanged) JSON text content. The server no longer advertises phantom
`logging`/`resources` capabilities — published 0.0.2 returned -32601 to
`logging/setLevel`, which made MCP Inspector unable to connect at all. Server
version now reports the real package version, tool descriptions embed CBS
usage guidance, concurrency bursts queue (FIFO, 5 active / 50 queued) instead
of hard-failing, and shutdown is graceful. Requires Node >= 20.
