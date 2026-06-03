import { divider, inputObject, inputString, log, readInputs, reportsRoot, requireEnv, sleep, writeJson, writeText } from "./_common.ts"

divider("Deploy Preview")

const inputs = readInputs()
const releaseManifest = inputObject<Record<string, unknown>>(inputs, "releaseManifest", {})
const targetEnvironment = inputString(inputs, "targetEnvironment", "preview")
const deployToken = requireEnv("DEPLOY_API_TOKEN")
const releaseVersion = String(releaseManifest.version ?? "v0-0-0-demo")
const previewSlug = releaseVersion.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const previewUrl = `https://${previewSlug}.preview.effect-cicd-demo.internal`

log(`Deploy token=${deployToken}`)
log(`Deploying ${releaseVersion} to ${targetEnvironment}`)
await sleep(700, "Uploading release manifest to preview control plane")
await sleep(700, "Creating isolated preview namespace and routing rules")
await sleep(700, "Waiting for preview pods to become ready")
await sleep(700, "Warming caches and registering deployment metadata")

await writeText(`.effect-demo/outputs/deploy/preview-url.txt`, `${previewUrl}\n`)
await writeJson(`.effect-demo/artifacts/deploy/deployment-log.json`, {
  targetEnvironment,
  previewUrl,
  releaseVersion,
  status: "ready",
  rolloutSteps: [
    "upload-release-manifest",
    "allocate-preview-namespace",
    "configure-ingress",
    "warm-preview-cache",
  ],
  generatedAt: new Date().toISOString(),
})
await writeText(
  `${reportsRoot}/deploy/summary.md`,
  [
    "# Preview Deployment Summary",
    "",
    `- Release version: ${releaseVersion}`,
    `- Target environment: ${targetEnvironment}`,
    `- Preview URL: ${previewUrl}`,
    "- Rollout status: ready",
  ].join("\n"),
)

log(`Preview environment is ready at ${previewUrl}`)
