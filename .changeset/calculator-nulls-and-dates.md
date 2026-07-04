---
"@reuvenorg/israel-statistics-mcp": patch
---

Calculator fixes: series that return null coefficient bounds (e.g. index
110050) now succeed instead of failing with a raw validation dump, and the
summary derives the percent change when CBS omits it. Calculator dates are
normalized to unambiguous `yyyy-mm-dd` before reaching CBS — Israeli-style
`dd-mm-yyyy` input was previously misread by CBS as mm-dd, silently producing
wrong linkage results; it is now auto-corrected when unambiguous (day > 12)
and rejected with a clear message otherwise.
