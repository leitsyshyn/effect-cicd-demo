import { divider, inputString, log, readInputs, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"

divider("Collect Preview Diagnostics")

const inputs = readInputs()
const previewUrl = inputString(inputs, "previewUrl", "https://preview.invalid")

log(`Collecting diagnostics for failed preview checks at ${previewUrl}`)
await sleep(300, "Snapshotting ingress config, recent deploy events, and preview logs")
await sleep(300, "Compiling incident timeline for operator follow-up")

await writeJson(`.effect-demo/artifacts/diagnostics/preview-diagnostics.json`, {
  previewUrl,
  suspectedFaultDomain: "preview-gateway",
  correlatedSignals: [
    "homepage returned HTTP 500",
    "release API returned HTTP 502",
    "worker remained healthy during failure window",
  ],
  generatedAt: new Date().toISOString(),
})
await writeText(
  `.effect-demo/artifacts/diagnostics/incident-timeline.md`,
  [
    "# Incident Timeline",
    "",
    "- T+00m deploy completed",
    "- T+01m smoke validation reported elevated 5xx responses",
    "- T+02m diagnostics bundle captured ingress and release API evidence",
  ].join("\n"),
)
await writeText(
  `${reportsRoot}/diagnostics/summary.md`,
  [
    "# Diagnostics Summary",
    "",
    `- Preview URL: ${previewUrl}`,
    "- Suspected fault domain: preview-gateway",
    "- Recommended action: inspect ingress overrides and release API upstream health",
  ].join("\n"),
)

log("Diagnostics bundle created for failed preview rollout")
