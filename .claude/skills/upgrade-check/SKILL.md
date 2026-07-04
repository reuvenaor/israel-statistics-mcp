---
name: upgrade-check
description: Check dependencies for updates and vulnerabilities, respecting this repo's version constraints (SDK 1.x/zod v3, eslint 9, TS 5.x).
disable-model-invocation: true
allowed-tools: Bash(pnpm outdated:*), Bash(pnpm audit:*), Bash(npm view:*), WebFetch, WebSearch, Read, Grep
---

# Dependency upgrade check

1. `pnpm audit --prod` and `pnpm audit` — report counts by severity. The prod tree must stay at **0**.
2. `pnpm outdated` — classify each row against the repo constraints:
   - `@modelcontextprotocol/sdk`: stay on **^1.x latest** until v2 is GA. On any bump, read the release notes (github.com/modelcontextprotocol/typescript-sdk/releases) for `registerTool`/zod changes. When v2 goes GA, flag it as a dedicated migration (Standard Schema + zod 4 + spec bump) — do not fold into a routine bump.
   - `zod`: **v3 line only** (`^3.25.x`) while on SDK 1.x. Never accept zod 4 from a bulk update.
   - `eslint`: stay on 9.x until `typescript-eslint` officially supports ESLint 10 (check their docs), then upgrade both together.
   - `typescript`: latest 5.x; TS 6 needs tsup + typescript-eslint support verification first.
   - Everything else: latest is fine; devDeps freely.
3. Check the Docker base digest and `packageManager` pnpm pin are current (Renovate normally handles these — flag if Renovate PRs are stuck).
4. After applying any upgrade: `pnpm install`, then run the `verify` skill. SDK bumps additionally require `node scripts/smoke.mjs --live`.
5. Output: table (package, current → target, action, risk note) + the audit summary.
