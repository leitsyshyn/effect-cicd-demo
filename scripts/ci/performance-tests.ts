import { divider, inputBoolean, inputObject, log, readInputs, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"

divider("Performance Tests")

const inputs = readInputs()
const buildManifest = inputObject<Record<string, unknown>>(inputs, "buildManifest", {})
const forceTimeoutJob = inputBoolean(inputs, "forceTimeoutJob", false)

log(`Starting performance validation for ${String(buildManifest.version ?? "unknown build")}`)
await sleep(300, "Provisioning synthetic load profile and warm caches")

if (forceTimeoutJob) {
  log("Timeout simulation requested; keeping the soak test open beyond the unit timeout")
  await Bun.sleep(15_000)
}

await sleep(500, "Executing mixed read/write load with preview traffic ratios")
const summary = {
  vus: 24,
  requests: 480,
  p50Ms: 73,
  p95Ms: 121,
  errorRate: 0.002,
  generatedAt: new Date().toISOString(),
}
await writeJson(`.effect-demo/artifacts/performance/k6-summary.json`, summary)
await writeText(
  `.effect-demo/artifacts/performance/latency.csv`,
  [
    "percentile,latency_ms",
    "p50,73",
    "p75,88",
    "p90,103",
    "p95,121",
    "p99,156",
  ].join("\n") + "\n",
)
await writeText(
  `${reportsRoot}/performance/summary.md`,
  [
    "# Performance Summary",
    "",
    `- Version: ${String(buildManifest.version ?? "unknown")}`,
    `- Virtual users: ${summary.vus}`,
    `- Requests: ${summary.requests}`,
    `- p95 latency: ${summary.p95Ms} ms`,
    `- Error rate: ${(summary.errorRate * 100).toFixed(2)}%`,
  ].join("\n"),
)

log(`Performance baseline recorded with p95 latency ${summary.p95Ms} ms`)
