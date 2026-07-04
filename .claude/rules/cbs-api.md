---
paths:
  - "src/mcp/**"
  - "src/schemas/**"
---

# CBS API constraints (apply when touching handlers/schemas)

Full spec: INSTRUCTIONS.md (repo root). Non-negotiables:

- Every request goes through `secureFetch` — never call `fetch` directly from a handler. It enforces: 30s timeout, mandatory User-Agent, `api.cbs.gov.il` host allowlist, single 5xx/network retry, 15MB cap.
- Endpoint formats: `index/catalog/*` + `data/price` + `data/calculator/{id}` = JSON; `data/price_selected`, `data/price_selected_b`, `data/price_all` = **XML only** (request `format=xml`, parse with the xml2js conventions: everything is arrays, text in `_`).
- Calculator dates sent to CBS must be `yyyy-mm-dd` (normalized in request schema — CBS misparses `dd-mm-yyyy` silently).
- Period params: monthly `MM-YYYY` (data/price), by-period `YYYYMM` with floor `199701`.
- `pagesize` ≤ 1000 (CBS cap). `value`/`last` must be positive.
- CBS reality to tolerate in response schemas: null coefficients (`mult_min`/`mult_max`/`Koeff`/`chaining_coefficient`/`change_percent`), inconsistent date strings (`2025-4`), empty XML containers (`""` → preprocess to empty arrays), non-numeric strings in XML numerics (guard with `parseNumberOrNull`).
- Housing (chapter `aa` / codes `18xxxx`): bi-monthly with 3 provisional periods — warnings must stay period-aware (computed window, not static text) and bilingual.
- Errors surfaced to the model must be concise `CbsApiError` messages (endpoint path, no query strings, zod issues digested to paths) — never raw ZodError JSON.
