# Plan: Unbreak the nightly live suite and fix three confirmed correctness bugs

**Status:** done

## Context

A full review of `israel-statistics-mcp` @ 1.0.0 turned up one broken pipeline and three real defects.

**The nightly failure (#17 and 7 duplicates) is not a CBS problem.** Every CBS tool passes in the failing run — all 22 live tests green, all 10 live-sweep tool calls green. The single failing check is `invalid args rejected cleanly` in `scripts/smoke.mjs`. Root cause, verified by reproduction: `scripts/smoke.mjs:60-61` runs `npx -y @modelcontextprotocol/inspector` **unpinned**, and Inspector **v2.0.0 published 2026-07-28T07:33Z**. The last green nightly ran 2026-07-28T04:27Z; every run since is red. Inspector v2 now **exits 5** when a tool result carries `isError: true` (v1 exited 0), so `execFileAsync` rejects and the check lands in the catch block. Verified directly: stdout is still a single clean JSON document with the correct payload, and the new `{"error":{"code":"tool_is_error"}}` envelope goes to **stderr**. `tools/list` is unaffected (exit 0, 9 tools, metadata intact). So the harness needs to accept the new exit convention — the server itself is correct.

**The issue spam is a second, independent bug.** `live.yml:38-43` dedupes via `gh issue list --label live-cbs-failure`, but that label **does not exist** in the repo. `gh issue create --label` therefore fails, the `|| gh issue create` fallback creates an _unlabeled_ issue, and the next night's dedupe query returns `[]` again — a new issue every night, forever. That is exactly issues #10–#17.

**Issue #7 is already fixed and verified closed-worthy.** `chapterSchema` became a regex in `dcf251f`. Calling `get_catalog_chapters` through the shipped 1.0.0 build returns all **14** chapters including `g` and `j` (and a duplicate `ba`), exit 0, no error. It has no _unit_ regression test, only live coverage.

**Three confirmed correctness bugs**, each with a concrete trigger:

1. **Silent pagination truncation.** CBS defaults `pagesize=100`. Verified live: `get_index_data(code=120010, 01-2000→12-2024)` → CBS reports `total_items: 300, last_page: 3` but returns 100 rows, and `getIndexData.ts:40-50` averages those 100 and reports _"Retrieved 100 data points. Average value: …"_ — presenting 8 years of mean as 25 years, with no mention of truncation. `get_subject_codes` is worse: `subjectCodesResponseSchema` has no `paging` key and is not `.passthrough()`, so zod strips the evidence entirely.
2. **Housing provisional window is a day early and host-local.** `housingWarnings.ts:48` uses `now.getDate() >= 15`. Per `INSTRUCTIONS.md:26` the Jul-15 publication is still the latest _through_ Aug 15, so the boundary is `> 15`. Combined with `getDate()` reading host-local time, a UTC+13 host on the Israeli 14th emits the **✅ "these values are final"** branch for a period that is still provisional — the precise unsafe-linkage advice the warning exists to prevent.
3. **Quarterly indices report "no data".** `getIndexData.ts:38` reads only `data.month`; `response.schema.ts:73` documents `month` as null for quarterly codes and defines a sibling `quarter` array no handler reads. Quarterly codes return _"No data points found …"_ while the data sits in `data.quarter`.

Clean bill of health worth recording: no `console.log`/`process.stdout.write` anywhere in `src/`; the `secureFetch` host allowlist resists URL-parsing tricks; the semaphore releases in a `finally`; calculator date normalization never lets `dd-mm-yyyy` reach CBS; tool names/count are in sync across README, `server.json`, `tools.ts`, and smoke.

## Spec

- WHEN a tool call returns `isError: true` and the Inspector exits non-zero, THE SYSTEM SHALL still parse the result from stdout and evaluate the check, so `pnpm smoke` and `node scripts/smoke.mjs --live` pass against Inspector v2.
- WHERE the smoke harness invokes the Inspector, THE SYSTEM SHALL request a pinned version so a new upstream release cannot turn CI red without a commit.
- WHEN the nightly live job fails, THE SYSTEM SHALL comment on the single existing open `live-cbs-failure` issue rather than creating a new one; IF the label is missing, THEN THE SYSTEM SHALL fail loudly instead of silently creating an unlabeled issue.
- WHEN `get_index_data` is called without an explicit `pagesize`, THE SYSTEM SHALL request CBS's maximum page size (1000).
- IF a CBS response reports more `total_items` than rows returned, THEN THE SYSTEM SHALL state the truncation in the summary and state that any average covers only the returned rows.
- WHEN `get_index_data` is called with a quarterly index code, THE SYSTEM SHALL report the quarterly data points it received instead of "No data points found".
- WHILE computing the housing provisional window, THE SYSTEM SHALL use Israel local time and SHALL treat a publication as available only _after_ the 15th.
- WHEN `get_catalog_chapters` receives a chapter list containing ids beyond `a..fa` (e.g. `g`, `j`) or a duplicate id, THE SYSTEM SHALL return them without a validation error.

Out of scope: auto-pagination / following `paging.next_url`; narrowing the 6-month housing window; redirect-host revalidation, streaming size cap, semaphore increment ordering, leap-year date guard, dead-fixture wiring, `server.json` version CI gate (all reviewed, all deferred — see Follow-ups).

## Decisions (locked with user)

| Decision             | Choice                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope of this plan   | P0 + P1: unbreak the nightly, plus the 3 confirmed correctness bugs, with unit repros                                                                                                                      |
| Pagination fix       | Default `pagesize=1000` when caller omits it, **plus** an honest summary when CBS still reports more rows than returned. Purely additive — no tool or param changes                                        |
| Housing window width | Keep the conservative 6-month window (over-warning is the safe direction); fix the label so it stops claiming the span is exactly the last 3 publications. Still fix the off-by-one and the local-time bug |

Safely defaulted (veto any):

- **Close #7 and all 8 nightly duplicates (#10–#17)** with an explanatory comment rather than leaving them open — #7 is verified fixed, and the duplicates all share one root cause being fixed here.
- **Pin the Inspector to `@2.1.0`** (current latest) via a single constant in `smoke.mjs`, while still accepting _both_ exit conventions so the harness is not brittle if the pin moves.
- **Version bump: minor (1.1.0)**, since the `pagesize` default and summary text are observable behavior changes. Requires syncing `server.json`'s three `version` fields.
- Israel time via `Asia/Jerusalem` with `Intl.DateTimeFormat` (no new dependency).

## Steps

- [x] Step 1: Fix `scripts/smoke.mjs` for Inspector v2 — in `inspector()`, catch the rejection and, when `err.stdout` parses as JSON, return it (rethrow otherwise); add an `INSPECTOR_VERSION = "2.1.0"` constant used in the argv. Comment why both exit conventions are accepted.
      _Accept: `node scripts/smoke.mjs` → "Smoke: 3/3 checks passed", exit 0._

- [x] Step 2: Repair the nightly issue automation in `.github/workflows/live.yml` — drop the `|| gh issue create` fallback so a missing label fails loudly, add `timeout-minutes` and a `concurrency` group to the `live` job, and de-indent the `body` heredoc.
      _Accept: `actionlint`/YAML parse clean; the create step has exactly one `gh issue create` with `--label live-cbs-failure`._

- [x] Step 3: Create the missing `live-cbs-failure` label in the repo (`gh label create`), then close #10–#17 as duplicates of one root cause and close #7 as already fixed, each with a short comment citing the evidence above.
      _Accept: `gh label list` shows `live-cbs-failure`; `gh issue list --state open` no longer lists #7 or #10–#17._
      _Deviation: #7 was already closed in the tracker; the verification comment was still added. `gh issue list --state open` now returns empty._

- [x] Step 4: Pin `npx --yes publint` to an exact version in `.github/workflows/ci.yml:67`.
      _Accept: grep shows no unpinned `npx -y`/`npx --yes` on a CI critical path._

- [x] Step 5: Fix pagination truncation in `src/mcp/handlers/getIndexData.ts` — pass `pagesize: args.pagesize ?? 1000` into `globalParams` (`secureFetch` already clamps at 1000), and when `data.paging.total_items` exceeds the rows returned, append an explicit truncation note to the summary stating the average covers only the returned rows. Apply the same `pagesize` default in `getSubjectCodes.ts`.
      _Accept: new unit test asserts `pagesize=1000` reaches `secureFetch` by default, is not overridden when the caller sets it, and that a mocked `total_items: 300` / 100-row payload produces a summary containing the truncation note._

- [x] Step 6: Handle quarterly series in `getIndexData.ts` — when `month` is empty but `data.quarter` has entries, summarize the quarterly points instead of "No data points found".
      _Accept: unit test with a `month: null` + populated `quarter` payload asserts the summary does not contain "No data points found"._

- [x] Step 7: Fix `src/mcp/helpers/housingWarnings.ts` — change the boundary to `> 15`, derive the day/month/year from `Asia/Jerusalem` rather than host-local time (keep the injectable `now` for tests), and reword the provisional line so it no longer claims the span is exactly the last 3 publications.
      _Accept: unit tests pin (a) `2026-08-15` → window ending `2026-05`, `2026-08-16` → ending `2026-06`; (b) a fixed instant evaluated under `TZ=Pacific/Auckland` and `TZ=UTC` yields the identical window._

- [x] Step 8: Add a unit regression test for issue #7 — a real `index/catalog/catalog` fixture captured from live CBS (14 chapters incl. `g`, `j`, duplicate `ba`) parsed through `catalogChaptersResponseSchema`, asserting no validation error and all 14 preserved.
      _Accept: `pnpm test` green; reverting `chapterSchema` to the old 11-value enum makes this test fail._

- [x] Step 9: Correct the two stale model-facing strings that still say 11 chapters `a..fa` — `src/server.ts:11` and `src/schemas/output.schema.ts:30`.
      _Accept: grep for `a\.\.fa` and `11 chapters` in `src/` returns nothing._

- [x] Step 10: Add a changeset (minor), sync all three `version` fields in `server.json` to the new version, and run the full local gate.
      _Accept: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && node scripts/smoke.mjs` all green; `jq -r '.version, .packages[].version' server.json` matches `package.json`._
      _Deviation: `server.json` deliberately left at 1.0.0. `changeset version` bumps `package.json` only when the Version PR lands, so writing 1.1.0 into `server.json` now would create exactly the drift the step exists to prevent. Both files are in sync at 1.0.0; bumping `server.json` to 1.1.0 stays the documented manual release step (docs/DEVELOPMENT.md, CLAUDE.md, the `/release` skill)._

## Verification

End-to-end, after all steps:

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — all green.
2. `node scripts/smoke.mjs` → **3/3 checks passed** (this is the check that has been red for 8 nights).
3. `node scripts/smoke.mjs --live` → **13/13 checks passed** — reproduces the nightly job locally and is the real proof #17 is closed.
4. Housing timezone proof: run the housing unit tests under `TZ=Pacific/Auckland pnpm test` and `TZ=UTC pnpm test` — identical results.
5. Pagination proof, through the built server against live CBS:
   `npx @modelcontextprotocol/inspector@2.1.0 --cli node dist/index.js --method tools/call --tool-name get_index_data --tool-arg code=120010 --tool-arg startPeriod=01-2000 --tool-arg endPeriod=12-2024`
   → expect 300 rows (not 100), or an explicit truncation note in `summary`.
6. Issue #7 proof: same command with `--tool-name get_catalog_chapters --tool-arg lang=en` → 14 chapters, `isError` absent.
7. `gh run list --workflow=live.yml` after the next scheduled run (or a manual `workflow_dispatch`) → success, and no new issue filed.

A reviewer should observe: the nightly's _only_ failing check was harness drift, not CBS drift; the three correctness fixes each ship with a unit repro per `.claude/rules/mcp-conventions.md`; and no tool name, parameter, or existing response key changed.

**Follow-ups (reviewed, deliberately deferred):** redirect-host revalidation in `secureFetch` (`redirect: "follow"` currently trusts any redirect target); body-read errors bypassing `CbsApiError` and the retry policy; the 15 MB cap not applying to chunked responses and counting UTF-16 units; `Semaphore.active++` ordering allowing over-subscription after a refactor; `DAYS_IN_MONTH` accepting Feb 29 in non-leap years; 4 captured-but-unreferenced fixtures; MCP round-trip output-schema coverage for the 7 tools that lack it; a CI gate asserting `server.json` version == `package.json` version.

## Summary

Diagnosed and fixed the 8-night nightly failure, which was **not** CBS drift: every CBS tool passed, and the single failing check broke because `scripts/smoke.mjs` ran the MCP Inspector unpinned and v2.0.0 (published 2026-07-28, hours after the last green run) changed the tool-error exit code from 0 to 5. The harness now reads the result from stdout regardless of exit code — working under both majors — and the Inspector version is pinned. A second, independent bug was filing a fresh duplicate issue every night: the dedupe query filtered on a `live-cbs-failure` label that did not exist, so the labelled create failed and an unlabelled fallback issue was created that the query could never find again. The label now exists and the silent fallback is gone.

Beyond the pipeline, three confirmed correctness defects were fixed with unit repros: `get_index_data` silently truncating long ranges at CBS's 100-row default while reporting the partial mean as the whole range (verified live: 100 of 300 points); the housing provisional window being a day early _and_ derived from host-local time, which could declare a still-provisional period "final" for money linkage on any far-east host; and quarterly index codes reporting "No data points found" while holding the full series in `data.quarter`. Issue #7 was verified already fixed in the shipped 1.0.0 build and gained the unit regression test it never had. All 9 issues in the tracker are closed; the repo has no open issues.

Final state: 98 unit tests (up from 88) green in four timezones, 22 live tests green, offline smoke 3/3, live smoke 13/13 — the exact nightly job now passes end to end.

### Unexpected changes

- **#7 was already closed** in the tracker when reached (the plan assumed it was open). The verification comment and the regression test were still valuable and were delivered.
- **`server.json` was deliberately not bumped.** The step called for syncing it to the new version, but `changeset version` bumps `package.json` only at release time; writing 1.1.0 now would create the drift the step exists to prevent. Both stay at 1.0.0.
- **The `fetcher` mock factory needed a new export.** Handlers import `CBS_MAX_PAGESIZE`, and all three unit files mock the whole module — without adding the constant to the factories, the fix silently degraded to `undefined` under test.
- **The first timezone test was not load-bearing.** Mutation testing showed the instant chosen did not discriminate between Israel and host time under the corrected boundary; it was replaced with one that does (Israel Aug 15 23:00 vs Auckland Aug 16 08:00).

### Conclusions

- **Unpinned `npx` on a CI critical path is a latent outage.** A dependency this repo never declared turned the nightly red for 8 days with no commit. `publint` was pinned for the same reason; nothing unpinned remains on a CI path.
- **Mutation testing earned its keep.** Every new test was verified to fail against the pre-fix code. Two tests that looked correct were not actually load-bearing until rewritten — worth doing routinely here, given how much of the suite asserts on mocked pass-through values.
- **The triage advice in the failure template was wrong for this case.** It offered "all tools fail = outage" vs "one tool fails = payload drift", with no branch for harness drift — the case that actually occurred. That third branch is now in the issue body.
- **PR CI cannot see CBS drift at all** (all unit tests mock the network), so the nightly is the only detector — which is why the duplicate-issue bug mattered more than it looked. Highest-value remaining follow-up is MCP round-trip output-schema coverage for the 7 tools that lack it, since a schema stricter than CBS reality turns a working tool into a hard failure.
