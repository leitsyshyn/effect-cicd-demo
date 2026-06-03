import { createReleaseManifest } from "../../src/index.ts"
import { divider, inputObject, inputString, log, readInputs, reportsRoot, requireEnv, sleep, writeJson, writeText } from "./_common.ts"

divider("Package Release")

const inputs = readInputs()
const releaseContext = inputObject<Record<string, unknown>>(inputs, "releaseContext", {})
const buildManifest = inputObject<Record<string, unknown>>(inputs, "buildManifest", {})
const riskLevel = inputString(inputs, "riskLevel", "medium") as "low" | "medium" | "high"
const registryToken = requireEnv("REGISTRY_TOKEN")

log(`Preparing release bundle for ${String(buildManifest.version ?? "unknown build")}`)
log(`Registry handshake token=${registryToken}`)
await sleep(350, "Assembling OCI metadata and release notes")
await sleep(350, "Promoting bundle into the demo artifact set")

const releaseManifest = createReleaseManifest({
  build: {
    version: String(buildManifest.version ?? "v0.0.0-demo"),
    channel: (String(buildManifest.channel ?? "candidate") as "stable" | "candidate" | "hotfix"),
    assetCount: Number(buildManifest.assetCount ?? 0),
    byteSize: Number(buildManifest.byteSize ?? 0),
    commitCount: Number(buildManifest.commitCount ?? 0),
    generatedAt: String(buildManifest.generatedAt ?? new Date().toISOString()),
    featureFlags: Array.isArray(buildManifest.featureFlags) ? buildManifest.featureFlags.map(String) : [],
  },
  targetEnvironment: String(releaseContext.targetEnvironment ?? "preview"),
  riskLevel,
  notes: [
    `Release train ${String(releaseContext.releaseTrain ?? "manual")}`,
    `Risk level ${riskLevel}`,
    `Commit count ${String(buildManifest.commitCount ?? 0)}`,
  ],
})

await writeJson(`.effect-demo/outputs/release/release-manifest.json`, releaseManifest)
await writeText(`.effect-demo/outputs/release/image-digest.txt`, `${releaseManifest.imageDigest}\n`)
await writeJson(`.effect-demo/artifacts/release/publish-bundle.json`, {
  releaseManifest,
  publishedBy: "effect-cicd-demo",
  registry: "registry.internal/effect-cicd-demo",
  generatedAt: new Date().toISOString(),
})
await writeText(
  `.effect-demo/artifacts/release/release-notes.md`,
  [
    `# Release ${releaseManifest.version}`,
    "",
    `- Channel: ${releaseManifest.channel}`,
    `- Target environment: ${releaseManifest.targetEnvironment}`,
    `- Risk level: ${releaseManifest.riskLevel}`,
    `- Image digest: ${releaseManifest.imageDigest}`,
  ].join("\n"),
)
await writeText(
  `${reportsRoot}/release/summary.md`,
  [
    "# Release Packaging Summary",
    "",
    `- Version: ${releaseManifest.version}`,
    `- Target environment: ${releaseManifest.targetEnvironment}`,
    `- Risk level: ${releaseManifest.riskLevel}`,
    `- Image digest: ${releaseManifest.imageDigest}`,
  ].join("\n"),
)

log(`Release package staged with digest ${releaseManifest.imageDigest}`)
