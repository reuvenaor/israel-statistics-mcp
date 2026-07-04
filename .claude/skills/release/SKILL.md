---
name: release
description: Prepare and gate a release — changeset, full verification, tarball install-and-run test, local Docker smoke, and the manual web-authenticated publish checklist.
disable-model-invocation: true
allowed-tools: Bash(pnpm:*), Bash(npm:*), Bash(node scripts/smoke.mjs:*), Bash(npx publint:*), Bash(docker build:*), Bash(docker run:*), Bash(tar:*), Bash(git:*), Bash(mkdir:*), Read, Grep, Edit, Write
---

# Release preparation & publish checklist

**Zero configured CI secrets** — CI never publishes. It only maintains the changesets "Version Packages" PR. Everything below the gates is done locally with web-authenticated accounts.

## Gates (run all before any publish)

1. **Changesets**: `pnpm changeset status` — every user-visible change since the last release has one (patch=fix, minor=feature, major=breaking).
2. **Verify**: run the `verify` skill (typecheck, lint, format:check, unit tests, build, offline smoke) and `node scripts/smoke.mjs --live` if network allows.
3. **Tarball gate (mandatory)**:
   - `pnpm build && pnpm pack`
   - `tar -tzf *.tgz`: ONLY `package/dist/*`, `package/README.md`, `package/LICENSE`, `package/package.json`
   - `tar -xzOf *.tgz package/dist/index.js | head -1` → `#!/usr/bin/env node`
   - `npx publint` → zero errors
   - **Install-and-run test** (what npx does on a user machine): in a temp dir, `npm init -y && npm install <abs path to .tgz>`; check both bins exist in `node_modules/.bin/`; then
     `node scripts/smoke.mjs --command "<tmpdir>/node_modules/.bin/israel-statistics-mcp"` (offline; add `--live` for full assurance)
   - delete the local `.tgz` afterwards
4. **Local Docker gate**: `docker build -t israel-statistics-mcp:dev .` then
   `node scripts/smoke.mjs --command "docker run --init --rm -i israel-statistics-mcp:dev"`. Confirm npm/npx/corepack/yarn are absent from the runtime image. Never push the `:dev` tag.
5. **Sync check**: README tool table (9) and `server.json` match `src/mcp/tools.ts`; `server.json` version equals the version being released (hand-maintained!).

## Publish (manual, in this order)

1. Merge the "Version Packages" PR on GitHub; `git checkout main && git pull`.
2. npm: `npm login` (browser) if needed → `pnpm release` (build + changeset publish + git tag) → `git push --follow-tags`.
3. Docker (Docker Desktop signed in):
   `docker buildx build --platform linux/amd64,linux/arm64 -t reuvenaor/israel-statistics-mcp:<version> -t reuvenaor/israel-statistics-mcp:latest --push .`
4. MCP Registry (requires npm package + Docker image to already exist):
   `mcp-publisher login github` (device flow) → `mcp-publisher publish`.
5. Docker Hub dashboard: paste the README as the repository description.
6. Post-publish sanity: from a NEUTRAL directory (not this repo), `npx -y @reuvenorg/israel-statistics-mcp` should start and log "[MCP] Server ready on stdio"; `docker run --init --rm -i reuvenaor/israel-statistics-mcp:latest` likewise.

Report the checklist as a table with pass/fail and stop at the first failed gate.
