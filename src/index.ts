import {
  createBuildManifest,
  createReleaseManifest,
  computeRiskLevel,
  detectReleaseChannel,
  normalizeReleaseVersion,
} from "./release.ts"

export {
  createBuildManifest,
  createReleaseManifest,
  computeRiskLevel,
  detectReleaseChannel,
  normalizeReleaseVersion,
} from "./release.ts"

if (import.meta.main) {
  const version = process.argv[2] ?? "1.0.0-demo.1"
  const normalizedVersion = normalizeReleaseVersion(version)
  const build = createBuildManifest({
    version: normalizedVersion,
    assetCount: 3,
    byteSize: 48_512,
    commitCount: 14,
    featureFlags: ["preview-deploy", "retry-simulation", "artifact-browser"],
  })
  const riskLevel = computeRiskLevel({ criticalFindings: 0, highFindings: 1, branchCoverage: 92 })
  const release = createReleaseManifest({
    build,
    targetEnvironment: "preview",
    riskLevel,
    notes: [
      `Prepared ${normalizedVersion} for preview rollout`,
      `Channel: ${detectReleaseChannel(normalizedVersion)}`,
    ],
  })

  console.log(JSON.stringify({ build, release }, null, 2))
}
