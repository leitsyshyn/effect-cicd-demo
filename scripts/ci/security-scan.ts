import { computeRiskLevel } from "../../src/index.ts"
import { divider, inputObject, log, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"
import { readInputs } from "./_common.ts"

divider("Security Scan")

const inputs = readInputs()
const buildManifest = inputObject<Record<string, unknown>>(inputs, "buildManifest", {})
const channel = String(buildManifest.channel ?? "stable")
const riskLevel = computeRiskLevel({
  criticalFindings: 0,
  highFindings: channel === "candidate" ? 1 : 0,
  branchCoverage: 92,
})

log(`Generating SBOM and vulnerability review for ${String(buildManifest.version ?? "unknown build")}`)
await sleep(300, "Enumerating runtime assets and transitive delivery metadata")
await sleep(300, "Evaluating findings against demo release policy")

await writeText(`.effect-demo/outputs/security/risk-level.txt`, `${riskLevel}\n`)
await writeJson(`.effect-demo/artifacts/security/sbom.spdx.json`, {
  spdxVersion: "SPDX-2.3",
  name: "effect-cicd-demo",
  documentNamespace: `urn:effect-cicd-demo:${String(buildManifest.version ?? "unknown")}`,
  packages: [
    {
      name: "effect-cicd-demo",
      versionInfo: String(buildManifest.version ?? "unknown"),
      primaryPackagePurpose: "APPLICATION",
    },
  ],
})
await writeJson(`.effect-demo/artifacts/security/vuln-report.json`, {
  riskLevel,
  findings: [
    {
      id: "CVE-DEMO-2026-0001",
      severity: channel === "candidate" ? "high" : "low",
      state: channel === "candidate" ? "mitigated-by-gating" : "accepted",
      component: "preview-gateway-shim",
    },
  ],
  generatedAt: new Date().toISOString(),
})
await writeText(
  `${reportsRoot}/security/summary.md`,
  [
    "# Security Summary",
    "",
    `- Build version: ${String(buildManifest.version ?? "unknown")}`,
    `- Release channel: ${channel}`,
    `- Aggregated risk: ${riskLevel}`,
    "- SBOM format: SPDX 2.3",
  ].join("\n"),
)

log(`Security review completed with aggregated risk level ${riskLevel}`)
