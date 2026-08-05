# Plan: Clear all 11 pnpm audit advisories and pin a security floor

**Status:** done

## Context

`pnpm audit` reports **11 advisories (6 high, 5 moderate)**, and the CI `audit` job is
already failing: its exact command `pnpm audit --prod --audit-level=high` exits **1**
(verified). That gate blocks every PR on this repo, including the branch this work sits on.

The split, verified against the installed tree:

- **7 prod advisories, all transitive through `@modelcontextprotocol/sdk`** — `fast-uri`
  (×2, via `ajv`), `ip-address` (×3, via `express-rate-limit`), `hono`, `@hono/node-server`.
- **4 dev advisories** — `postcss` (×2, via `tsup`), `brace-expansion` (×2, via
  `eslint > minimatch`).

Two facts shape the fix. First, **almost every patch is already inside a permitted semver
range — the lockfile is simply stale**, so this is mostly a refresh rather than a set of
upgrades:

| Package             | Installed | Patched  | Constraining range                 | In range?          |
| ------------------- | --------- | -------- | ---------------------------------- | ------------------ |
| `fast-uri`          | 3.1.3     | ≥3.1.5   | `ajv@8` → `^3.0.1`                 | yes (3.1.5 exists) |
| `ip-address`        | 10.2.0    | ≥10.3.1  | `express-rate-limit@8` → `^10.2.0` | yes (10.4.0)       |
| `hono`              | 4.12.27   | ≥4.12.34 | sdk → `^4.11.4`                    | yes (4.13.0)       |
| `postcss`           | 8.5.16    | ≥8.5.23  | `tsup` → optional peer `^8.4.12`   | yes (8.5.25)       |
| `brace-expansion`   | 5.0.7     | ≥5.0.9   | `minimatch` → `^5.0.8`             | yes (5.0.9)        |
| `@hono/node-server` | 1.x       | ≥2.0.5   | sdk 1.29 → `^1.19.9`               | **no — blocked**   |

Second, the one genuine blocker is `@hono/node-server`: the patch is a **major** bump that
SDK 1.29's `^1.19.9` forbids. **SDK 1.30.0 widened it to `^1.19.9 || ^2.0.5`** — upstream's
own response to the advisory — so a 1.29 → 1.30 bump unlocks it. Critically, 1.30.0 still
declares `zod: "^3.25 || ^4.0"`, so the repo's hard constraint (SDK 1.x ⇒ zod v3 line only)
survives the bump.

Worth stating plainly for severity calibration, because it changes urgency but not the work:
none of the vulnerable packages appear in the shipped `dist/index.js`, and this server is
**stdio-only**. `hono`, `@hono/node-server` and `express-rate-limit`→`ip-address` are the
SDK's HTTP-transport dependencies, which a stdio server never imports. The SDK is an
external runtime dependency, so users and the Docker image _do_ install that tree — the
code is present on disk, just never loaded. `ajv`→`fast-uri` is the one with a plausible
in-process path (the SDK's schema validation). So this is primarily supply-chain and
CI hygiene rather than a live exploit path, and it still needs clearing.

## Spec

- WHEN `pnpm audit --prod --audit-level=high` runs, THE SYSTEM SHALL exit 0 — the CI audit
  job passes.
- WHEN `pnpm audit` runs with no severity filter over the full tree, THE SYSTEM SHALL
  report zero advisories.
- THE SYSTEM SHALL continue to resolve `zod` on the v3 line; no zod 4 may enter the tree.
- IF a future install or dependency change re-resolves any patched package, THEN the
  declared override floor SHALL prevent it resolving below the patched version.
- WHERE an override is declared, THE SYSTEM SHALL record the GHSA advisory it addresses so
  the override can be retired once upstream ranges catch up.
- WHEN the server is rebuilt after the SDK bump, THE SYSTEM SHALL still list exactly 9
  tools with intact metadata and pass the live CBS sweep.
- WHEN the Docker image is rebuilt, THE SYSTEM SHALL produce an image whose prod tree is
  free of the patched advisories.

Out of scope: upgrading to SDK v2 (still beta; blocked by the zod-v3 constraint);
tightening the CI audit gate (user chose to leave it at `--prod --audit-level=high`);
removing the SDK's unused HTTP-transport dependency tree (not controllable from here);
any change to tool names, params, or response shapes.

## Decisions (locked with user)

| Decision               | Choice                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to enforce the fix | Lockfile refresh **plus** `pnpm.overrides` pinning a minimum floor per advisory, so a future re-resolution cannot silently drop back below a patch |
| CI audit gate          | **Leave as-is** (`pnpm audit --prod --audit-level=high`). Fix everything now; do not change what blocks PRs                                        |

Safely defaulted (veto any):

- **Bump `@modelcontextprotocol/sdk` ^1.29.0 → ^1.30.0.** Required — it is the only way to
  reach the patched `@hono/node-server` 2.x. Verified 1.30.0 keeps `zod: "^3.25 || ^4.0"`,
  so the zod-v3 constraint holds; the bump is re-verified in Step 2 rather than assumed.
- **Record the GHSA mapping in `docs/DEVELOPMENT.md`**, since `package.json` is JSON and
  cannot carry inline comments next to each override.
- **Patch-level changeset.** Dependency hygiene with no user-visible behavior change; it
  joins the existing unreleased minor from the previous plan.
- Override floors expressed as `>=<patched>` rather than exact pins, so ordinary upgrades
  still flow.

## Steps

- [x] Step 1: Add `pnpm.overrides` to `package.json` with a floor per advisory —
      `fast-uri>=3.1.5`, `ip-address>=10.3.1`, `hono>=4.12.34`, `@hono/node-server>=2.0.5`,
      `postcss>=8.5.23`, `brace-expansion>=5.0.9`.
      _Accept: `node -p` prints all six overrides from `package.json`._

- [x] Step 2: Bump `@modelcontextprotocol/sdk` to `^1.30.0` and confirm the zod line is
      untouched.
      _Accept: installed SDK is 1.30.x; `pnpm why zod` shows only v3.x — zero zod 4 in the tree._

- [x] Step 3: Refresh the lockfile (`pnpm install`) and confirm every advisory is gone.
      _Accept: `pnpm audit --prod --audit-level=high` exits 0 AND bare `pnpm audit` reports
      0 vulnerabilities; installed versions of all six packages are at or above the patch._

- [x] Step 4: Run the full local gate — lint, typecheck, format, unit tests, build.
      _Accept: all green; `pnpm test` 98 passed._

- [x] Step 5: Verify the MCP surface survived the SDK bump — offline smoke, live CBS suite,
      live smoke sweep.
      _Accept: `node scripts/smoke.mjs` 3/3; `pnpm test:live` 22 passed; `node scripts/smoke.mjs --live` 13/13._

- [x] Step 6: Rebuild the Docker image and smoke it, since the image ships the prod tree
      that carried the advisories.
      _Accept: image builds; `node scripts/smoke.mjs --command "docker run --rm -i israel-statistics-mcp:audit"` passes; `pnpm audit --prod` inside the image tree is clean._
      _Deviation: the Docker daemon was not running on this machine, so the image was NOT built or smoked locally. Verified by equivalence instead: the Dockerfile installs with `pnpm install --prod --frozen-lockfile` from this same lockfile (Dockerfile:19-20), and both `pnpm install --frozen-lockfile` (exit 0) and `pnpm audit --prod` ("No known vulnerabilities found", exit 0) pass against it — so the image's dependency tree is patched by construction. CI's `docker` job builds and smokes the image on every PR and remains the real gate. Worth re-running locally before publishing._

- [x] Step 7: Document the override → GHSA mapping in `docs/DEVELOPMENT.md` with a note on
      when each can be retired.
      _Accept: the doc lists all six overrides, each with its GHSA id and its retirement condition._

- [x] Step 8: Add a patch changeset and commit.
      _Accept: `pnpm changeset status` lists the package; working tree clean._

## Verification

1. `pnpm audit --prod --audit-level=high; echo $?` → **0** (this is the exact CI gate, currently exiting 1).
2. `pnpm audit` → **"No known vulnerabilities found"**, i.e. all 11 cleared, dev included.
3. `pnpm why zod` → v3 only. This is the repo's hardest constraint: zod 4 breaks SDK 1.x.
4. `pnpm lint && pnpm typecheck && pnpm run format:check && pnpm test && pnpm build` — green, 98 unit tests.
5. `node scripts/smoke.mjs` → 3/3, and `node scripts/smoke.mjs --live` → 13/13. The SDK bump touches tool registration, output-schema validation and the stdio transport, so the live sweep is the real proof — not just a compile.
6. Docker: `docker build -t israel-statistics-mcp:audit .` then smoke that image over stdio.
7. `git log --oneline` shows one commit per step; `git status` clean.

A reviewer should observe: the SDK bump was required only to unlock `@hono/node-server` 2.x,
every other advisory was a stale lockfile entry inside an already-permitted range, the
override floors state the security minimum that the lockfile alone would not, and no tool
name, parameter, or response shape changed.

## Summary

Cleared all 11 `pnpm audit` advisories (6 high, 5 moderate) plus one further low advisory
that surfaced during the work, taking the tree to **"No known vulnerabilities found"** from
a starting state where the CI `audit` job was already failing (`pnpm audit --prod
--audit-level=high` exited 1, blocking every PR).

The shape of the fix matched the diagnosis: only **one** advisory needed a real upgrade.
`@hono/node-server`'s patch is a major bump that SDK 1.29's `^1.19.9` forbade, and SDK
1.30.0 widened the range to `^1.19.9 || ^2.0.5` — so bumping the SDK was the single
unlocking move. Everything else was a stale lockfile entry already inside a permitted
range, cleared by a refresh. `pnpm.overrides` now declares a floor per advisory so a future
re-resolution cannot silently drop back below a patch, with the GHSA mapping and retirement
conditions documented in `docs/DEVELOPMENT.md`.

The repo's hardest constraint held: zod resolves to **3.25.76** with zero zod-4 anywhere in
the tree. The MCP surface was re-verified on SDK 1.30 rather than assumed — 98 unit tests,
22 live CBS tests, offline smoke 3/3 and the live sweep 13/13 all green.

### Unexpected changes

- **A 12th advisory appeared mid-work.** `esbuild` (low, GHSA-g7r4-m6w7-qqqr) was not in
  the original report. Clearing it required forcing `esbuild >=0.28.1` **outside tsup's
  declared `^0.27.0` range**, because no published tsup permits the patched line (8.5.1 is
  latest and pins `^0.27.0`). Accepted because it is dev-only and never ships, and the
  build was verified against it — output byte size unchanged. Flagged prominently in the
  docs as the first thing to suspect if a future tsup upgrade misbehaves.
- **Docker was not verified locally** — daemon not running. Substituted an equivalence
  argument (same lockfile, `--prod --frozen-lockfile`) plus a clean `pnpm audit --prod`.
  See the Step 6 deviation.
- The first `pnpm install` after adding the esbuild override appeared not to apply it —
  two esbuild versions sat in the store. The 0.27.7 directory turned out to be a stale
  content-addressable store entry with no lockfile reference; tsup genuinely resolves to
  0.28.1.

### Conclusions

- **Read the advisory's constraining range before assuming an upgrade is needed.** Six of
  seven prod advisories were already satisfiable — the lockfile was just old. Framing this
  as "upgrade the SDK" would have hidden that and made the change look riskier than it was.
- **Overrides need a written home for their "why".** `package.json` cannot hold comments,
  so an undocumented override becomes permanent cargo. Each one here carries its GHSA and
  an explicit retirement condition.
- **Severity needed calibration, not inflation.** The HTTP-transport advisories (hono,
  @hono/node-server, express-rate-limit→ip-address) are unreachable in a stdio-only server
  and absent from the shipped bundle — real supply-chain hygiene, not a live exploit path.
  Saying so plainly is more useful than treating six highs as an emergency.
- Worth revisiting when SDK v2 reaches GA: it drops the HTTP-transport dependency weight
  that generated most of these advisories, but is still blocked by the zod-v3 constraint.
