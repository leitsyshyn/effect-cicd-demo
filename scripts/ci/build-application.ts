import { bytesForFiles, divider, inputObject, listFiles, log, readInputs, reportsRoot, sleep, writeJson, writeText } from "./_common.ts"
import { createBuildManifest, normalizeReleaseVersion } from "../../src/index.ts"

divider("Build Application")

const inputs = readInputs()
const releaseContext = inputObject<Record<string, unknown>>(inputs, "releaseContext", {})
const releaseVersion = normalizeReleaseVersion(typeof releaseContext.releaseVersion === "string" ? releaseContext.releaseVersion : "1.4.0-demo.1")

log(`Bundling application sources for ${releaseVersion}`)
await sleep(300, "Preparing build output directory and resolving entrypoints")

const buildResult = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: ".effect-demo/build-output/app",
  target: "bun",
  sourcemap: "none",
  write: true,
})

if (!buildResult.success) {
  throw new Error("Application build failed")
}

await sleep(350, "Inspecting generated assets and composing manifest")
const buildFiles = await listFiles([".effect-demo/build-output/app"])
const totalBytes = await bytesForFiles(buildFiles)
const buildManifest = createBuildManifest({
  version: releaseVersion,
  assetCount: buildFiles.length,
  byteSize: totalBytes,
  commitCount: typeof releaseContext.commitCount === "number" ? releaseContext.commitCount : 14,
  featureFlags: ["preview-deploy", "artifact-browser", "retry-simulation"],
})

await writeJson(`.effect-demo/outputs/build/build-manifest.json`, buildManifest)
await writeJson(`.effect-demo/artifacts/build/bundle-metadata.json`, {
  entrypoint: "src/index.ts",
  assets: buildFiles.map((file) => file.replace(`${process.cwd()}/`, "")),
  totalBytes,
  generatedAt: new Date().toISOString(),
})
await writeText(
  `.effect-demo/artifacts/build/build-trace.log`,
  [
    `releaseVersion=${releaseVersion}`,
    `assetCount=${buildFiles.length}`,
    `totalBytes=${totalBytes}`,
    ...buildFiles.map((file) => `asset=${file.replace(`${process.cwd()}/`, "")}`),
  ].join("\n") + "\n",
)
await writeText(
  `${reportsRoot}/build/summary.md`,
  [
    "# Build Summary",
    "",
    `- Version: ${buildManifest.version}`,
    `- Channel: ${buildManifest.channel}`,
    `- Assets generated: ${buildManifest.assetCount}`,
    `- Total bundle size: ${buildManifest.byteSize} bytes`,
  ].join("\n"),
)

for (const file of buildFiles) {
  log(`Built asset ${file.replace(`${process.cwd()}/`, "")}`)
}

log(`Build manifest recorded with ${buildManifest.assetCount} assets totaling ${buildManifest.byteSize} bytes`)
