import { expect, test } from "bun:test"

import {
  createBuildManifest,
  createReleaseManifest,
  computeRiskLevel,
  detectReleaseChannel,
  normalizeReleaseVersion,
} from "../src/index.ts"

test("normalizeReleaseVersion prefixes bare versions", () => {
  expect(normalizeReleaseVersion("1.2.3")).toBe("v1.2.3")
})

test("normalizeReleaseVersion preserves v-prefixed versions", () => {
  expect(normalizeReleaseVersion("v2.0.0-rc.1")).toBe("v2.0.0-rc.1")
})

test("detectReleaseChannel recognizes candidate versions", () => {
  expect(detectReleaseChannel("1.4.0-demo.2")).toBe("candidate")
})

test("computeRiskLevel escalates when coverage drops", () => {
  expect(
    computeRiskLevel({
      criticalFindings: 0,
      highFindings: 0,
      branchCoverage: 78,
    }),
  ).toBe("high")
})

test("release manifests carry the build digest and target environment", () => {
  const build = createBuildManifest({
    version: "1.8.0",
    assetCount: 4,
    byteSize: 93_024,
    commitCount: 27,
    featureFlags: ["preview-deploy"],
    generatedAt: "2026-06-03T12:00:00.000Z",
  })

  const release = createReleaseManifest({
    build,
    targetEnvironment: "preview",
    riskLevel: "low",
    notes: ["All required checks passed"],
  })

  expect(release.version).toBe("v1.8.0")
  expect(release.targetEnvironment).toBe("preview")
  expect(release.imageDigest.startsWith("sha256:")).toBe(true)
  expect(release.notes).toContain("All required checks passed")
})
