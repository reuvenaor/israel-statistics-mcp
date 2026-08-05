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
- WHEN the published OCI image is scanned, THE SYSTEM SHALL report no high or critical
  vulnerabilities in either the base layer or the bundled `node_modules`.
- THE SYSTEM SHALL run as a non-root user with no package manager or shell tooling left in
  the runtime layer, and SHALL contain no source, tests, or credentials.
- WHERE the image is published to the MCP Registry as an OCI package, THE SYSTEM SHALL
  carry an `io.modelcontextprotocol.server.name` label exactly equal to the `name` in
  `server.json`, since that label is what proves namespace ownership at publish time.
- WHILE a release is in flight, THE SYSTEM SHALL keep the version identical across all
  three publishing channels — npm, the OCI tag, and `server.json`.

Out of scope: upgrading to SDK v2 (still beta; blocked by the zod-v3 constraint);
tightening the CI audit gate (user chose to leave it at `--prod --audit-level=high`);
removing the SDK's unused HTTP-transport dependency tree (not controllable from here);
any change to tool names, params, or response shapes.

## Decisions (locked with user)

| Decision                     | Choice                                                                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How to enforce the fix       | Lockfile refresh **plus** `pnpm.overrides` pinning a minimum floor per advisory, so a future re-resolution cannot silently drop back below a patch                                                                                                               |
| CI audit gate                | **Leave as-is** (`pnpm audit --prod --audit-level=high`). Fix everything now; do not change what blocks PRs                                                                                                                                                      |
| Scope extension (2026-08-06) | Reopened after closing: add a `/security-review` of the **Docker/OCI image** across all three publishing channels, since `pnpm audit` only covers the dependency tree and says nothing about the base layer, the runtime surface, or registry-ownership metadata |

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
      _Deviation (superseded by Step 9): the Docker daemon was not running on this machine, so the image was NOT built or smoked locally. Verified by equivalence instead: the Dockerfile installs with `pnpm install --prod --frozen-lockfile` from this same lockfile (Dockerfile:19-20), and both `pnpm install --frozen-lockfile` (exit 0) and `pnpm audit --prod` ("No known vulnerabilities found", exit 0) pass against it — so the image's dependency tree is patched by construction. CI's `docker` job builds and smokes the image on every PR and remains the real gate. Worth re-running locally before publishing._

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

- [x] Step 9: Build the image and run a `/security-review` over it — scan base layer and
      bundled `node_modules` for CVEs (`docker scout cves`, the scanner available here; no
      trivy/grype/syft installed), and review the runtime surface: non-root uid, absence of
      npm/npx/corepack/yarn and shells, no source/tests/secrets in the final layer, no
      unnecessary ports or HEALTHCHECK.
      _Accept: image builds; scan reports 0 critical and 0 high; `docker run --rm --entrypoint sh` fails or finds no package manager; `id` inside the image is uid 1001, not root._
      _Deviation: the "0 critical / 0 high" bar was met for the **npm layer** (0C 0H 0M 0L) but NOT for the Debian base, which carries ~45 advisories over 14 packages incl. 2C+2H in `perl`. Established these are unfixable: only `perl-base` is installed, it is `Essential=yes, Priority=required` so apt refuses removal, Debian marks all four "not fixed", and the newest `24-bookworm-slim` digest still scans 3C/8H. Built and smoke-tested a distroless variant as the alternative (works, 9 tools, 3/3, 243MB vs 379MB) but the user chose to keep bookworm-slim: distroless ships Node <24.17.0 with 2 HIGH in the node binary itself, i.e. trading unreachable perl CVEs for a stale runtime we do execute. Accepted risk documented in docs/DEVELOPMENT.md. Shells (/bin/sh, /bin/bash) remain, inherent to the slim base._
      _Also found here: a SECOND Inspector v2 regression. `--cli docker run --rm -i <image>` loses its `--rm`/`-i` flags under v2 ("'docker run' requires at least 1 argument"), which would have turned ci.yml's `docker` job red. Fixed in `2914281` by switching the harness to the `--config`/`--server` form; verified on node, bookworm and distroless spawns (3/3 each)._

- [x] Step 10: Verify publishing-channel integrity for all three targets — npm tarball,
      Docker Hub OCI tag, MCP Registry entry.
      _Accept: the image's `io.modelcontextprotocol.server.name` label equals `server.json`'s `name`; the OCI identifier tag equals the released version; `pnpm pack` + `publint` clean with the tarball limited to dist/README/LICENSE/package.json; provenance/attestation flags confirmed for the documented `docker buildx --push` step._

- [x] Step 11: Re-promote the plan into `docs/plans/` and re-add both INDEX entries (the
      earlier promotion was reverted in `eefb0be` because the plan reopened).
      _Accept: `docs/plans/2026-08-06-*.md` exists with matching entries in the repo INDEX and the global INDEX._

## Summary

Cleared all 11 `pnpm audit` advisories plus one that surfaced mid-work, taking the tree to
**"No known vulnerabilities found"** from a state where the CI `audit` job was already
failing and blocking every PR. Only one advisory needed a real upgrade: `@hono/node-server`'s
patch is a major bump SDK 1.29's `^1.19.9` forbade, and SDK 1.30.0 widened the range to
`^1.19.9 || ^2.0.5`. Everything else was a stale lockfile entry inside an already-permitted
range. `pnpm.overrides` now declares a floor per advisory, documented with GHSA ids and
retirement conditions.

The plan was then **reopened** to add a security review of the Docker/OCI image, since
`pnpm audit` covers the dependency tree and says nothing about the base layer, the runtime
surface, or registry-ownership metadata. That review confirmed the overrides reach the image
(npm layer 0C/0H/0M/0L), the runtime is hardened (uid 1001, no package managers, no
source/secrets), and all three publishing channels are coherent (ownership label matches
`server.json`, versions in sync, npm tarball clean and publint-green). The Debian base CVEs
were investigated to a firm conclusion and accepted as unreachable, with distroless
evaluated and rejected on evidence rather than assumed.

The review also caught a CI-breaking bug unrelated to dependencies — see below.

### Unexpected changes

- **A second Inspector v2 regression, found only because the image was actually exercised.**
  `--cli docker run --rm -i <image>` loses its flags under v2, so `ci.yml`'s `docker` job
  would have gone red on the next PR — the same upstream release that caused the previous
  plan's 8-night outage, a different symptom, and not covered by that fix. Repaired by
  moving the harness to the Inspector's `--config`/`--server` form, which has no flag
  ambiguity. Verified across node, bookworm and distroless spawns.
- **A 12th advisory (esbuild, low) appeared mid-work** and required forcing esbuild outside
  tsup's declared `^0.27.0`; dev-only and build-verified.
- **The base-image finding could not be fixed, only reasoned about.** `perl-base` is
  Debian-essential and unpatched upstream. The valuable output was disproving the obvious
  remedies (apt purge, digest refresh, distroless) with evidence rather than shipping a
  change that looked safer and was not.
- The published `reuvenaor/israel-statistics-mcp:1.0.0` on Docker Hub still ships the
  vulnerable `fast-uri@3.1.3` / `ip-address@10.2.0` — the user's own scan report showed
  exactly this. It stays vulnerable until the image is rebuilt and pushed at release.

### Conclusions

- **Read the constraining range before assuming an upgrade.** Six of seven prod advisories
  were already satisfiable; framing this as "upgrade the SDK" would have hidden that.
- **Scanning the dependency tree is not scanning the artifact.** `pnpm audit` was clean
  while the image still had 45 base-layer advisories, and the image-level review is what
  caught the CI-breaking docker-spawn bug. Worth doing before every publish, not just when
  an advisory lands.
- **"Not fixed" advisories need a decision, not a fix.** Chasing 2C/2H in an essential,
  unpatched Debian package would have meant a worse base image. Documenting unreachability
  is the honest answer.
- **Overrides need a written home for their "why"** — package.json cannot hold comments, so
  each override carries its GHSA and an explicit retirement condition.
- Revisit at SDK v2 GA (drops the HTTP-transport dependency weight behind most of these
  advisories, still blocked by the zod-v3 constraint), and if Debian ever patches perl.
