import { createImageDigest } from "../../src/release.ts"
import { divider, inputObject, log, readInputs, reportsRoot, requireEnv, sleep, writeJson, writeText } from "./_common.ts"

const kind = process.env.EFFECT_DEMO_PUBLISH_KIND ?? "edge"

divider(`Publish ${kind === "release" ? "Release" : "Edge"}`)

const inputs = readInputs()
const releaseManifest = inputObject<Record<string, unknown>>(inputs, "releaseManifest", {})
const version = String(releaseManifest.version ?? "v0.0.0-demo")

if (kind === "release") {
  const signingKey = requireEnv("RELEASE_SIGNING_KEY")
  log(`Release signing key=${signingKey}`)
  await sleep(400, "Generating signed release attestation and immutable bundle id")

  const signedReleaseId = createImageDigest([version, String(releaseManifest.imageDigest ?? "missing-digest"), "signed-release"])
  await writeText(`.effect-demo/outputs/publish/signed-release-id.txt`, `${signedReleaseId}\n`)
  await writeJson(`.effect-demo/artifacts/publish/release-signoff.json`, {
    version,
    signedReleaseId,
    signingProfile: "demo-release-profile",
    generatedAt: new Date().toISOString(),
  })
  await writeText(
    `${reportsRoot}/publish/release-summary.md`,
    [
      "# Release Publish Summary",
      "",
      `- Version: ${version}`,
      `- Signed release id: ${signedReleaseId}`,
      "- Promotion target: stable release channel",
    ].join("\n"),
  )

  log(`Signed release promotion prepared with bundle id ${signedReleaseId}`)
} else {
  const registryToken = requireEnv("REGISTRY_TOKEN")
  log(`Registry handshake token=${registryToken}`)
  await sleep(400, "Promoting edge image and updating deployment catalog")

  const publishTarget = `registry.internal/effect-cicd-demo:${version}`
  await writeText(`.effect-demo/outputs/publish/publish-target.txt`, `${publishTarget}\n`)
  await writeJson(`.effect-demo/artifacts/publish/edge-publish.json`, {
    version,
    publishTarget,
    channel: "edge",
    generatedAt: new Date().toISOString(),
  })
  await writeText(
    `${reportsRoot}/publish/edge-summary.md`,
    [
      "# Edge Publish Summary",
      "",
      `- Version: ${version}`,
      `- Publish target: ${publishTarget}`,
      "- Promotion target: edge channel",
    ].join("\n"),
  )

  log(`Edge publish metadata recorded for ${publishTarget}`)
}
