---
name: release
description: Prepare a release — changeset, full verification, npm pack + publint inspection, local Docker smoke, and the publish checklist.
disable-model-invocation: true
allowed-tools: Bash(pnpm:*), Bash(node scripts/smoke.mjs:*), Bash(npx publint:*), Bash(docker build:*), Bash(docker run --rm -i israel-statistics-mcp:*), Bash(tar:*), Bash(git:*), Read, Grep, Edit, Write
---

# Release preparation

Never `npm publish` by hand — `release.yml` (changesets) is the only publish path. This skill prepares and gates.

1. **Changeset**: ensure every user-visible change since the last release has a changeset (`pnpm changeset status --since=main`). If missing, create with `pnpm changeset` — patch for fixes, minor for features/SDK bumps/engine changes (0.x convention).
2. **Full verify**: run the `verify` skill steps (typecheck, lint, unit, build, offline smoke, live smoke).
3. **Tarball gate (mandatory before any publish)**:
   - `pnpm pack` → inspect with `tar -tzf *.tgz`: must contain ONLY `package/dist/*`, `package/README.md`, `package/LICENSE`, `package/package.json`.
   - `head -1` of packed `dist/index.js` = `#!/usr/bin/env node`.
   - `npx publint` → zero errors.
   - Delete the local `.tgz` afterwards.
4. **Local Docker gate**: `docker build -t israel-statistics-mcp:dev .` then
   `node scripts/smoke.mjs --command "docker run --rm -i israel-statistics-mcp:dev"` (offline) and `--live` variant if network allows. Never push the `:dev` tag.
5. **Sync checklist** (all must match `src/mcp/tools.ts`):
   - README tool table lists all 9 tools; install snippets use `npx -y`; version-sensitive text updated.
   - `server.json`: packages/identifiers correct (version itself is CI-patched — don't hand-edit).
   - `package.json` `mcpName` + Dockerfile `io.modelcontextprotocol.server.name` label unchanged.
6. Report the checklist with pass/fail. Merging the changesets "Version Packages" PR on main triggers the actual publish (npm + provenance → Docker → MCP Registry).
