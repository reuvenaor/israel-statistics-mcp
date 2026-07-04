---
name: live-test
description: Run the live CBS API test suite and triage failures (real regression vs CBS outage).
disable-model-invocation: true
allowed-tools: Bash(pnpm build), Bash(pnpm test:*), Bash(node scripts/smoke.mjs:*), Bash(curl -sI https://api.cbs.gov.il/*), Read, Grep
---

# Live CBS suite

1. `pnpm build && pnpm test:live` (live vitest project: 30s timeouts, retry 2, sequential).
2. `node scripts/smoke.mjs --live` (one representative call per tool through Inspector CLI).

## Triage rules

- **All tools failing with timeouts/5xx** → CBS outage or WAF issue. Check `curl -sI "https://api.cbs.gov.il/index/catalog/catalog?format=json&download=false"` — if it's not 200, stop and report "CBS unavailable", do NOT change code.
- **Single endpoint failing schema validation** → CBS changed a payload shape. Capture the new payload into `src/__tests__/fixtures/`, adjust the response schema tolerantly (nullable/passthrough), add a unit repro.
- **Calculator cases**: 110050 must succeed with null coefficients; 120010 must return numeric linkage. A failure here is always a regression, never CBS drift (both fixtures are pinned).
- Hebrew cases failing while English passes → encoding regression in fetcher/parse path.

Report: table of case → status → diagnosis. Never mark the suite "passed" if any case was skipped silently.
