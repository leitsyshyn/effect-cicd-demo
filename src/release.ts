import { createHash } from "node:crypto"

export type ReleaseChannel = "stable" | "candidate" | "hotfix"
export type RiskLevel = "low" | "medium" | "high"

export interface BuildManifest {
  readonly version: string
  readonly channel: ReleaseChannel
  readonly assetCount: number
  readonly byteSize: number
  readonly commitCount: number
  readonly generatedAt: string
  readonly featureFlags: ReadonlyArray<string>
}

export interface ReleaseManifest {
  readonly version: string
  readonly channel: ReleaseChannel
  readonly targetEnvironment: string
  readonly imageDigest: string
  readonly riskLevel: RiskLevel
  readonly notes: ReadonlyArray<string>
}

export const normalizeReleaseVersion = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error("Release version must be non-empty")
  }

  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`
}

export const detectReleaseChannel = (version: string): ReleaseChannel => {
  const normalized = normalizeReleaseVersion(version).toLowerCase()

  if (normalized.includes("hotfix")) {
    return "hotfix"
  }

  if (normalized.includes("rc") || normalized.includes("beta") || normalized.includes("demo")) {
    return "candidate"
  }

  return "stable"
}

export const computeRiskLevel = (options: {
  readonly criticalFindings: number
  readonly highFindings: number
  readonly branchCoverage: number
}): RiskLevel => {
  if (options.criticalFindings > 0 || options.highFindings > 3 || options.branchCoverage < 80) {
    return "high"
  }

  if (options.highFindings > 0 || options.branchCoverage < 90) {
    return "medium"
  }

  return "low"
}

export const createBuildManifest = (options: {
  readonly version: string
  readonly assetCount: number
  readonly byteSize: number
  readonly commitCount: number
  readonly featureFlags: ReadonlyArray<string>
  readonly generatedAt?: string
}): BuildManifest => ({
  version: normalizeReleaseVersion(options.version),
  channel: detectReleaseChannel(options.version),
  assetCount: options.assetCount,
  byteSize: options.byteSize,
  commitCount: options.commitCount,
  featureFlags: [...options.featureFlags],
  generatedAt: options.generatedAt ?? new Date().toISOString(),
})

export const createImageDigest = (parts: ReadonlyArray<string>) => {
  const hash = createHash("sha256")
  for (const part of parts) {
    hash.update(part)
    hash.update("\n")
  }
  return `sha256:${hash.digest("hex")}`
}

export const createReleaseManifest = (options: {
  readonly build: BuildManifest
  readonly targetEnvironment: string
  readonly riskLevel: RiskLevel
  readonly notes: ReadonlyArray<string>
}): ReleaseManifest => ({
  version: options.build.version,
  channel: options.build.channel,
  targetEnvironment: options.targetEnvironment,
  riskLevel: options.riskLevel,
  imageDigest: createImageDigest([
    options.build.version,
    options.build.channel,
    options.targetEnvironment,
    `${options.build.assetCount}`,
    `${options.build.byteSize}`,
    `${options.build.commitCount}`,
  ]),
  notes: [...options.notes],
})
