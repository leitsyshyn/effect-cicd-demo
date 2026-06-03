import { divider, log, sleep, writeJson, writeText } from "./_common.ts"

divider("Quickstart")
log("Preparing a tiny dashboard-created demo run")
await sleep(300, "Writing a small artifact and report")

await writeJson(`.effect-demo/artifacts/quickstart/hello.json`, {
  project: "quickstart",
  status: "ready",
  generatedAt: new Date().toISOString(),
})
await writeText(`.effect-demo/reports/quickstart/summary.txt`, "quickstart pipeline finished\n")

log("Quickstart demo payloads are ready")
