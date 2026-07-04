---
"@reuvenorg/israel-statistics-mcp": patch
---

Schema resilience against real CBS behavior: empty XML result sets return
clean zero-result summaries instead of validation errors; non-numeric XML
values become typed nulls instead of NaN; chapter ids accept the growing CBS
catalog (new g/j chapters) instead of a hardcoded 11-value enum; numeric-
looking string params (code, startDate, endDate) accept numbers too;
`coef=true` actually returns linkage coefficients now; housing warnings fire
for 18xxxx codes and Hebrew names and carry a computed provisional window
instead of static text. The unused `format` parameter of get_index_data was
removed (ignored if sent). Dead dependencies removed — the published package
drops 9 unused runtime deps; `pnpm audit` is clean (0 vulnerabilities).
