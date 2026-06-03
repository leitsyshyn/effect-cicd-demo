import { divider, inputBoolean, inputString, log, readInputs, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"

divider("Smoke Preview")

const inputs = readInputs()
const previewUrl = inputString(inputs, "previewUrl", "https://preview.invalid")
const failSmoke = inputBoolean(inputs, "failSmoke", false)

log(`Running smoke checks against ${previewUrl}`)
await sleep(350, "Checking homepage, health endpoint, and release banner")

const checks = [
  { name: "GET /", latencyMs: 118, status: failSmoke ? 500 : 200 },
  { name: "GET /healthz", latencyMs: 42, status: 200 },
  { name: "GET /api/releases/current", latencyMs: 71, status: failSmoke ? 502 : 200 },
]

await writeJson(`.effect-demo/artifacts/smoke/smoke-results.json`, {
  previewUrl,
  checks,
  passed: !failSmoke,
  generatedAt: new Date().toISOString(),
})
await writeText(
  `.effect-demo/artifacts/smoke/http-trace.txt`,
  checks.map((check) => `${check.name} -> ${check.status} in ${check.latencyMs}ms`).join("\n") + "\n",
)
await writeText(
  `${reportsRoot}/smoke/summary.md`,
  [
    "# Preview Smoke Summary",
    "",
    `- Preview URL: ${previewUrl}`,
    `- Result: ${failSmoke ? "failed" : "passed"}`,
    `- Checked endpoints: ${checks.length}`,
  ].join("\n"),
)

if (failSmoke) {
  log("Smoke validation failed on the homepage and release API checks")
  process.exit(1)
}

log("Preview smoke validation passed")
