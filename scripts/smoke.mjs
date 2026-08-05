#!/usr/bin/env node
/**
 * MCP smoke harness — drives the server through the official MCP Inspector CLI.
 *
 * Modes:
 *   node scripts/smoke.mjs                 offline: tools/list + invalid-args call
 *   node scripts/smoke.mjs --live          + one real CBS call per tool (retried)
 *   node scripts/smoke.mjs --command "docker run --rm -i israel-statistics-mcp:dev"
 *                                          smoke any spawn form (e.g. a local image)
 *
 * Zero dependencies. Runs the Inspector from a neutral temp cwd so npx-based
 * commands never resolve to this repo's local package by name.
 */
import { execFile } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const argv = process.argv.slice(2)
const LIVE = argv.includes("--live")
const commandIndex = argv.indexOf("--command")
const serverCommand =
  commandIndex !== -1 && argv[commandIndex + 1]
    ? argv[commandIndex + 1].split(" ").filter(Boolean)
    : ["node", join(projectRoot, "dist", "index.js")]

// Pinned: an unpinned `npx -y @modelcontextprotocol/inspector` floated to v2.0.0
// on 2026-07-28 and turned the nightly red for 8 days with no commit in this repo.
const INSPECTOR_VERSION = "2.1.0"

const EXPECTED_TOOLS = [
  "get_all_indices",
  "get_catalog_chapters",
  "get_chapter_topics",
  "get_index_calculator",
  "get_index_data",
  "get_index_topics",
  "get_main_indices",
  "get_main_indices_by_period",
  "get_subject_codes",
]

// Neutral cwd: `npx <this-package>` inside the repo resolves to the local
// project instead of the registry — a real footgun found during testing.
const workDir = mkdtempSync(join(tmpdir(), "israstat-smoke-"))

const results = []
let failed = false

function report(name, ok, detail = "") {
  results.push({ name, ok, detail })
  const mark = ok ? "PASS" : "FAIL"
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failed = true
}

async function inspector(args, { timeoutMs = 120_000 } = {}) {
  const npxArgs = [
    "-y",
    `@modelcontextprotocol/inspector@${INSPECTOR_VERSION}`,
    "--cli",
    ...serverCommand,
    ...args,
  ]
  const execOpts = {
    cwd: workDir,
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  }
  try {
    const { stdout } = await execFileAsync("npx", npxArgs, execOpts)
    return JSON.parse(stdout)
  } catch (err) {
    // Exit-code conventions differ across Inspector majors: v1 exited 0 for a
    // tool result carrying isError:true, v2 exits 5 and prints a
    // {"error":{"code":"tool_is_error"}} envelope on *stderr*. In both cases
    // stdout is still the single, complete JSON-RPC result — which is exactly
    // what the invalid-args check needs to inspect. Accept any exit code whose
    // stdout parses; rethrow anything else (spawn failure, timeout, crash).
    if (typeof err.stdout === "string" && err.stdout.trim()) {
      try {
        return JSON.parse(err.stdout)
      } catch {
        // fall through — stdout was not a usable result
      }
    }
    throw err
  }
}

async function callTool(name, toolArgs, { retries = LIVE ? 3 : 1 } = {}) {
  const args = ["--method", "tools/call", "--tool-name", name]
  for (const [key, value] of Object.entries(toolArgs)) {
    args.push("--tool-arg", `${key}=${value}`)
  }
  let lastError
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await inspector(args)
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 5_000 * attempt))
      }
    }
  }
  throw lastError
}

function structured(result) {
  const text = result.content?.find((c) => c.type === "text")?.text
  const parsedText = text ? JSON.parse(text) : undefined
  if (
    result.structuredContent &&
    JSON.stringify(result.structuredContent) !== JSON.stringify(parsedText)
  ) {
    throw new Error("structuredContent does not match text content")
  }
  return result.structuredContent ?? parsedText
}

async function main() {
  console.log(
    `MCP smoke — command: ${serverCommand.join(" ")}${LIVE ? " (live)" : ""}`
  )

  // Step 1 — offline: the Inspector must connect and list exactly 9 tools.
  // (Published v0.0.2 failed right here: phantom capabilities → -32601.)
  try {
    const { tools } = await inspector(["--method", "tools/list"])
    const names = tools.map((t) => t.name).sort()
    const namesOk = JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS)
    report("inspector connects + 9 tools listed", namesOk, names.join(","))
    const metaOk = tools.every(
      (t) =>
        t.title &&
        t.description &&
        t.outputSchema &&
        t.annotations?.readOnlyHint === true
    )
    report("every tool has title/description/outputSchema/readOnlyHint", metaOk)
  } catch (err) {
    report(
      "inspector connects + 9 tools listed",
      false,
      String(err).slice(0, 200)
    )
    finish()
    return
  }

  // Step 2 — offline: schema-invalid args must fail cleanly before any I/O.
  try {
    const result = await callTool("get_index_data", {
      code: "120010",
      startPeriod: "13-2020",
    })
    const text = result.content?.[0]?.text ?? ""
    report(
      "invalid args rejected cleanly",
      result.isError === true && text.includes("mm-yyyy"),
      text.slice(0, 80)
    )
  } catch (err) {
    report("invalid args rejected cleanly", false, String(err).slice(0, 200))
  }

  if (LIVE) {
    await liveSweep()
  }

  finish()
}

async function liveSweep() {
  console.log("  --- live sweep (real CBS calls) ---")

  const checks = [
    {
      name: "get_catalog_chapters",
      args: { lang: "en" },
      verify: (s) => (s.chapters?.length ?? 0) >= 11,
    },
    {
      name: "get_index_topics",
      args: { lang: "en", pagesize: 2 },
      verify: (s) => typeof s.summary === "string",
    },
    {
      name: "get_chapter_topics",
      args: { chapterId: "aa", lang: "en" },
      verify: (s) => s.topics?.length > 0 && s.summary.includes("Housing"),
    },
    {
      name: "get_index_data",
      args: { code: "120010", last: 2, lang: "en" },
      verify: (s) => (s.data?.month?.[0]?.date?.length ?? 0) > 0,
    },
    {
      name: "get_index_calculator (120010 happy)",
      tool: "get_index_calculator",
      args: {
        indexCode: 120010,
        value: 1000,
        fromDate: "2020-01-01",
        toDate: "2025-06-01",
        lang: "en",
      },
      verify: (s) => s.answer?.to_value > 1000,
    },
    {
      name: "get_index_calculator (110050 null-coeff regression)",
      tool: "get_index_calculator",
      args: {
        indexCode: 110050,
        value: 1000,
        fromDate: "2020-01-01",
        toDate: "2025-06-01",
        lang: "en",
      },
      verify: (s) => s.answer?.mult_min === null && s.answer?.to_value > 0,
    },
    {
      name: "get_main_indices",
      args: { lang: "en" },
      verify: (s) => s.indices?.length > 0,
    },
    {
      name: "get_main_indices_by_period",
      args: { startDate: "202401", endDate: "202402" },
      verify: (s) => s.totalIndices > 0,
    },
    {
      name: "get_all_indices",
      args: { chapter: "a", lang: "en" },
      verify: (s) =>
        typeof s.summary === "string" && s.summary.includes("chapter a"),
    },
  ]

  let subjectId
  for (const check of checks) {
    const toolName = check.tool ?? check.name
    try {
      const result = await callTool(toolName, check.args)
      if (result.isError) {
        report(check.name, false, result.content?.[0]?.text?.slice(0, 120))
        continue
      }
      const s = structured(result)
      report(check.name, Boolean(check.verify(s)))
      if (toolName === "get_chapter_topics" && s.topics?.[0]?.subjectId) {
        subjectId = s.topics[0].subjectId
      }
    } catch (err) {
      report(check.name, false, String(err).slice(0, 160))
    }
  }

  // Chained call: subject codes discovered from the chapter sweep above.
  if (subjectId != null) {
    try {
      const result = await callTool("get_subject_codes", {
        subjectId,
        lang: "en",
      })
      const s = structured(result)
      report("get_subject_codes (chained)", (s.codes?.length ?? 0) > 0)
    } catch (err) {
      report("get_subject_codes (chained)", false, String(err).slice(0, 160))
    }
  } else {
    report("get_subject_codes (chained)", false, "no subjectId discovered")
  }
}

function finish() {
  rmSync(workDir, { recursive: true, force: true })
  const passed = results.filter((r) => r.ok).length
  console.log(`\nSmoke: ${passed}/${results.length} checks passed`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error("Smoke harness crashed:", err)
  rmSync(workDir, { recursive: true, force: true })
  process.exit(1)
})
