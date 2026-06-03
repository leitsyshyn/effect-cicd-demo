import { artifactsRoot, demoRoot, divider, listFiles, log, markdownList, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"

divider("Static Analysis")
log("Scanning source, tests, scripts, and workflow modules for policy violations")

const files = await listFiles(["src", "tests", "scripts", ".effect/workflows"])
let todoCount = 0
let fixmeCount = 0
let consoleCount = 0

for (const file of files) {
  const content = await Bun.file(file).text()
  todoCount += (content.match(/TODO/g) ?? []).length
  fixmeCount += (content.match(/FIXME/g) ?? []).length
  consoleCount += (content.match(/\bconsole\./g) ?? []).length
}

await sleep(350, "Running bundle verification to catch syntax and import issues")
const bundleCheck = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: `${demoRoot}/tmp/static-analysis`,
  target: "bun",
  sourcemap: "none",
})

const findings = [
  { severity: "info", code: "FILES_SCANNED", message: `Scanned ${files.length} tracked source files` },
  { severity: todoCount > 0 ? "warn" : "info", code: "TODO_COUNT", message: `TODO markers detected: ${todoCount}` },
  { severity: fixmeCount > 0 ? "warn" : "info", code: "FIXME_COUNT", message: `FIXME markers detected: ${fixmeCount}` },
  { severity: consoleCount > 0 ? "info" : "info", code: "CONSOLE_CALLS", message: `console.* usage count: ${consoleCount}` },
  { severity: bundleCheck.success ? "info" : "error", code: "BUNDLE_CHECK", message: bundleCheck.success ? "Bundle verification passed" : "Bundle verification failed" },
]

await writeJson(`${artifactsRoot}/static-analysis/policy-checks.json`, {
  scannedFiles: files.length,
  todoCount,
  fixmeCount,
  consoleCount,
  bundleVerification: bundleCheck.success,
  generatedAt: new Date().toISOString(),
})
await writeText(
  `${artifactsRoot}/static-analysis/findings.ndjson`,
  findings.map((finding) => JSON.stringify(finding)).join("\n") + "\n",
)
await writeText(
  `${reportsRoot}/static-analysis/summary.md`,
  [
    "# Static Analysis Summary",
    "",
    markdownList(findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`)),
  ].join("\n"),
)

for (const finding of findings) {
  log(`${finding.code}: ${finding.message}`)
}

if (!bundleCheck.success) {
  throw new Error("Bundle verification failed during static analysis")
}
