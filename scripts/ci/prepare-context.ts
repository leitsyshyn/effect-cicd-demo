import { artifactsRoot, divider, inputBoolean, inputString, log, markdownList, readInputs, readJsonFile, reportsRoot, sleep, stateRoot, workspaceFingerprint, writeJson, writeText } from "./_common.ts"

const mode = process.env.EFFECT_DEMO_PIPELINE_MODE ?? "manual"
const inputs = readInputs()
const packageJson = await readJsonFile<Record<string, unknown>>("package.json", {})
const releaseVersion = inputString(inputs, "releaseVersion", mode === "github" ? "1.4.0-main.0" : "1.4.0-demo.1")
const targetEnvironment = inputString(inputs, "targetEnvironment", mode === "github" ? "edge" : "preview")
const runPerformance = inputBoolean(inputs, "runPerformance", false)
const injectIntegrationFlake =
  mode === "github"
    ? process.env.EFFECT_DEMO_INTEGRATION_FLAKE === "enabled"
    : inputBoolean(inputs, "injectIntegrationFlake", false)
const failSmoke = inputBoolean(inputs, "failSmoke", false)
const forceTimeoutJob = inputBoolean(inputs, "forceTimeoutJob", false)

divider("Prepare Context")
log(`Preparing workspace metadata for ${mode} pipeline execution`)
await sleep(250, "Collecting repository fingerprint inputs")

const fingerprint = await workspaceFingerprint(["src", "tests", "scripts", "README.md", "package.json", ".effect/workflows"])

const releaseContext = {
  mode,
  releaseVersion,
  targetEnvironment,
  commitCount: mode === "github" ? 19 : 14,
  releaseTrain: mode === "github" ? "push-validated" : "operator-driven",
  runPerformance,
  injectIntegrationFlake,
  failSmoke,
  forceTimeoutJob,
  generatedAt: new Date().toISOString(),
}

await sleep(300, "Writing run-level coordination flags for downstream jobs")
await writeJson(`${stateRoot}/run-flags.json`, {
  mode,
  injectIntegrationFlake,
  integrationFlakeConsumed: false,
  failSmoke,
  forceTimeoutJob,
  runPerformance,
})

await sleep(250, "Persisting workflow outputs and artifacts")
await writeJson(`${artifactsRoot}/context/dependency-snapshot.json`, {
  packageName: packageJson.name ?? "effect-cicd-demo",
  version: packageJson.version ?? "0.1.0",
  runtime: "bun",
  scripts: packageJson.scripts ?? {},
  generatedAt: new Date().toISOString(),
  trackedDirectories: ["src", "tests", "scripts", ".effect/workflows"],
})
await writeJson(`.effect-demo/outputs/context/release-context.json`, releaseContext)
await writeText(`.effect-demo/outputs/context/workspace-fingerprint.txt`, `${fingerprint}\n`)
await writeText(
  `${reportsRoot}/context/summary.md`,
  [
    "# Context Summary",
    "",
    `- Pipeline mode: ${mode}`,
    `- Release version: ${releaseVersion}`,
    `- Target environment: ${targetEnvironment}`,
    `- Performance stage requested: ${runPerformance}`,
    `- Integration flake requested: ${injectIntegrationFlake}`,
    `- Smoke failure requested: ${failSmoke}`,
    `- Timeout simulation requested: ${forceTimeoutJob}`,
    "",
    "## Included paths",
    markdownList(["src", "tests", "scripts", ".effect/workflows"]),
    "",
    `Fingerprint: ${fingerprint}`,
  ].join("\n"),
)

log(`Release context prepared for ${releaseVersion} targeting ${targetEnvironment}`)
log(`Workspace fingerprint ${fingerprint.slice(0, 16)} captured for downstream traceability`)
