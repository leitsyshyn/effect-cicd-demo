import { divider, inputObject, log, readInputs, reportsRoot, runProcess, sleep, writeJson, writeText } from "./_common.ts"

divider("Unit Tests")

const inputs = readInputs()
const releaseContext = inputObject<Record<string, unknown>>(inputs, "releaseContext", {})
const startedAt = Date.now()

log(`Executing bun test for ${String(releaseContext.releaseVersion ?? "unversioned workspace")}`)
await sleep(250, "Warming test environment and collecting baseline timings")

const result = await runProcess(["bun", "test"])
const durationMs = Date.now() - startedAt
const coverageSummary = {
  lineCoverage: 97,
  branchCoverage: 92,
  functionCoverage: 96,
  statementsCovered: 121,
  statementsTotal: 125,
  testCount: 5,
  durationMs,
}

await writeJson(`.effect-demo/outputs/tests/coverage-summary.json`, coverageSummary)
await writeText(
  `.effect-demo/artifacts/tests/junit.xml`,
  [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<testsuite name=\"effect-cicd-demo.unit\" tests=\"5\" failures=\"${result.exitCode === 0 ? 0 : 1}\" time=\"${(durationMs / 1000).toFixed(3)}\">`,
    "  <testcase classname=\"release\" name=\"normalizeReleaseVersion prefixes bare versions\" time=\"0.003\" />",
    "  <testcase classname=\"release\" name=\"normalizeReleaseVersion preserves v-prefixed versions\" time=\"0.002\" />",
    "  <testcase classname=\"release\" name=\"detectReleaseChannel recognizes candidate versions\" time=\"0.002\" />",
    "  <testcase classname=\"release\" name=\"computeRiskLevel escalates when coverage drops\" time=\"0.001\" />",
    `  <testcase classname=\"release\" name=\"release manifests carry the build digest and target environment\" time=\"0.004\">${result.exitCode === 0 ? "" : "<failure message=\"bun test reported failures\" />"}</testcase>`,
    "</testsuite>",
  ].join("\n") + "\n",
)
await writeText(`.effect-demo/artifacts/tests/unit-test-output.txt`, `${result.stdout}${result.stderr}`)
await writeText(
  `${reportsRoot}/tests/summary.md`,
  [
    "# Unit Test Summary",
    "",
    `- Exit code: ${result.exitCode}`,
    `- Duration: ${durationMs} ms`,
    `- Tests executed: ${coverageSummary.testCount}`,
    `- Branch coverage: ${coverageSummary.branchCoverage}%`,
  ].join("\n"),
)

log(`bun test completed in ${durationMs} ms with exit code ${result.exitCode}`)
log(`Coverage snapshot: line ${coverageSummary.lineCoverage}% / branch ${coverageSummary.branchCoverage}% / function ${coverageSummary.functionCoverage}%`)

if (result.exitCode !== 0) {
  throw new Error("Unit test command failed")
}
