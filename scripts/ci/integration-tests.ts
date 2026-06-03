import { divider, inputObject, log, readInputs, readJsonFile, reportsRoot, sleep, stateRoot, writeJson, writeText } from "./_common.ts"

interface RunFlags {
  readonly injectIntegrationFlake?: boolean
  readonly integrationFlakeConsumed?: boolean
  readonly mode?: string
}

divider("Integration Tests")

const inputs = readInputs()
const buildManifest = inputObject<Record<string, unknown>>(inputs, "buildManifest", {})
const coverageSummary = inputObject<Record<string, unknown>>(inputs, "coverageSummary", {})
const flags = await readJsonFile<RunFlags>(`${stateRoot}/run-flags.json`, {})

log(`Booting ephemeral integration stack for ${String(buildManifest.version ?? "unknown build")}`)
await sleep(400, "Starting api, worker, and database containers")
await sleep(400, "Waiting for readiness checks and fixture hydration")

if (flags.injectIntegrationFlake === true && flags.integrationFlakeConsumed !== true) {
  await writeJson(`${stateRoot}/run-flags.json`, {
    ...flags,
    integrationFlakeConsumed: true,
  })
  await writeText(
    `.effect-demo/artifacts/integration/compose.log`,
    [
      "db-1      | database system is ready to accept connections",
      "api-1     | loaded 12 migration files",
      "worker-1  | draining stale jobs",
      "tests-1   | checkout flow: expected HTTP 202 from preview gateway, received 503",
      "tests-1   | dependency reset detected after cold restart, marking run as retriable",
    ].join("\n") + "\n",
  )
  await writeText(
    `.effect-demo/artifacts/integration/junit.xml`,
    [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<testsuite name=\"effect-cicd-demo.integration\" tests=\"3\" failures=\"1\" time=\"4.219\">",
      "  <testcase classname=\"checkout\" name=\"checkout returns accepted preview handoff\" time=\"1.841\">",
      "    <failure message=\"transient preview gateway 503\">Gateway returned 503 during first-attempt warm-up</failure>",
      "  </testcase>",
      "  <testcase classname=\"catalog\" name=\"catalog search index stays queryable\" time=\"1.118\" />",
      "  <testcase classname=\"notifications\" name=\"notification worker acknowledges release event\" time=\"1.260\" />",
      "</testsuite>",
    ].join("\n") + "\n",
  )
  await writeText(
    `${reportsRoot}/integration/summary.md`,
    [
      "# Integration Summary",
      "",
      "- Result: failed on first attempt",
      "- Failure class: transient environment warm-up",
      `- Upstream branch coverage: ${String(coverageSummary.branchCoverage ?? "unknown")}%`,
      "- Expected recovery path: orchestrator retry",
    ].join("\n"),
  )

  log("Preview gateway returned a transient 503 during cold start")
  log("Failure is deliberate for demo purposes so retry scheduling is visible")
  process.exit(1)
}

await sleep(350, "Running checkout, catalog, and notification contract checks")
await writeText(
  `.effect-demo/artifacts/integration/compose.log`,
  [
    "db-1      | database system is ready to accept connections",
    "api-1     | loaded 12 migration files",
    "worker-1  | event bus connected",
    "tests-1   | checkout flow passed in 842ms",
    "tests-1   | catalog query path passed in 611ms",
    "tests-1   | notification worker acked release event in 188ms",
  ].join("\n") + "\n",
)
await writeText(
  `.effect-demo/artifacts/integration/junit.xml`,
  [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<testsuite name=\"effect-cicd-demo.integration\" tests=\"3\" failures=\"0\" time=\"3.012\">",
    "  <testcase classname=\"checkout\" name=\"checkout returns accepted preview handoff\" time=\"0.842\" />",
    "  <testcase classname=\"catalog\" name=\"catalog search index stays queryable\" time=\"0.611\" />",
    "  <testcase classname=\"notifications\" name=\"notification worker acknowledges release event\" time=\"0.188\" />",
    "</testsuite>",
  ].join("\n") + "\n",
)
await writeText(
  `${reportsRoot}/integration/summary.md`,
  [
    "# Integration Summary",
    "",
    `- Result: succeeded (${String(flags.mode ?? "manual")} mode)`,
    `- Build version: ${String(buildManifest.version ?? "unknown")}`,
    `- Upstream branch coverage: ${String(coverageSummary.branchCoverage ?? "unknown")}%`,
    "- Services exercised: api, worker, database, preview gateway shim",
  ].join("\n"),
)

log("Integration stack passed all contract checks")
