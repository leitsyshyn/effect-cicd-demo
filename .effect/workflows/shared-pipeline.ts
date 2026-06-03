import {
  Artifact,
  Command,
  Condition,
  Input,
  Job,
  Output,
  Policy,
  Report,
  Trigger,
  Workflow,
} from "@effect-cicd/dsl"

type DemoWorkflowMode = "manual" | "github"

const manualInputs = [
  Input.make("releaseVersion", { metadata: { label: "Release Version", example: "1.4.0-demo.6" } }),
  Input.make("targetEnvironment", { metadata: { label: "Target Environment", allowedValues: ["preview", "staging"] } }),
  Input.make("runPerformance", { metadata: { label: "Run Performance Stage" } }),
  Input.make("injectIntegrationFlake", { metadata: { label: "Inject Retryable Integration Failure" } }),
  Input.make("failSmoke", { metadata: { label: "Fail Preview Smoke Checks" } }),
  Input.make("forceTimeoutJob", { metadata: { label: "Force Performance Timeout" } }),
]

const baseJob = (
  unitId: string,
  name: string,
  script: string,
  mode: DemoWorkflowMode,
  env: Record<string, string> = {},
) =>
  Job.make(unitId).pipe(
    Job.named(name),
    Job.image("oven/bun:1"),
    Job.exec(Command.argv("bun", ["run", `scripts/ci/${script}.ts`])),
    Job.env({
      CI: "true",
      FORCE_COLOR: "0",
      EFFECT_DEMO_PIPELINE_MODE: mode,
      ...env,
    }),
    Job.workingDirectory("."),
  )

const createCommonJobs = (mode: DemoWorkflowMode) => {
  const prepareContextBase = baseJob("unit:prepare-context", "prepare context", "prepare-context", mode, {
    EFFECT_DEMO_INTEGRATION_FLAKE: mode === "github" ? "enabled" : "from-input",
  }).pipe(
    Job.output(
      Output.file("releaseContext", ".effect-demo/outputs/context/release-context.json", { format: "json" }),
      Output.file("workspaceFingerprint", ".effect-demo/outputs/context/workspace-fingerprint.txt", { format: "text" }),
    ),
    Job.artifact(
      Artifact.file("dependencySnapshot", ".effect-demo/artifacts/context/dependency-snapshot.json", {
        contentType: "application/json",
      }),
    ),
    Job.report(Report.file("contextSummary", ".effect-demo/reports/context/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const prepareContext =
    mode === "manual"
      ? prepareContextBase.pipe(
          Job.input(
            Input.fromWorkflow("releaseVersion", "releaseVersion"),
            Input.fromWorkflow("targetEnvironment", "targetEnvironment"),
            Input.fromWorkflow("runPerformance", "runPerformance"),
            Input.fromWorkflow("injectIntegrationFlake", "injectIntegrationFlake"),
            Input.fromWorkflow("failSmoke", "failSmoke"),
            Input.fromWorkflow("forceTimeoutJob", "forceTimeoutJob"),
          ),
        )
      : prepareContextBase

  const staticAnalysis = baseJob("unit:static-analysis", "static analysis", "static-analysis", mode).pipe(
    Job.dependsOn("unit:prepare-context"),
    Job.artifact(
      Artifact.file("policyChecks", ".effect-demo/artifacts/static-analysis/policy-checks.json", {
        contentType: "application/json",
      }),
      Artifact.file("analysisFindings", ".effect-demo/artifacts/static-analysis/findings.ndjson", {
        contentType: "application/x-ndjson",
      }),
    ),
    Job.report(Report.file("staticAnalysisSummary", ".effect-demo/reports/static-analysis/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const buildApplication = baseJob("unit:build-application", "build application", "build-application", mode).pipe(
    Job.dependsOn("unit:prepare-context", "unit:static-analysis"),
    Job.input(Input.fromJob("releaseContext", "unit:prepare-context", "releaseContext")),
    Job.output(Output.file("buildManifest", ".effect-demo/outputs/build/build-manifest.json", { format: "json" })),
    Job.artifact(
      Artifact.file("bundleMetadata", ".effect-demo/artifacts/build/bundle-metadata.json", { contentType: "application/json" }),
      Artifact.file("buildTrace", ".effect-demo/artifacts/build/build-trace.log", { contentType: "text/plain" }),
    ),
    Job.report(Report.file("buildSummary", ".effect-demo/reports/build/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const unitTests = baseJob("unit:unit-tests", "unit tests", "unit-tests", mode).pipe(
    Job.dependsOn("unit:prepare-context", "unit:static-analysis"),
    Job.input(Input.fromJob("releaseContext", "unit:prepare-context", "releaseContext")),
    Job.output(Output.file("coverageSummary", ".effect-demo/outputs/tests/coverage-summary.json", { format: "json" })),
    Job.artifact(
      Artifact.file("unitJunit", ".effect-demo/artifacts/tests/junit.xml", { contentType: "application/xml" }),
      Artifact.file("unitTestOutput", ".effect-demo/artifacts/tests/unit-test-output.txt", { contentType: "text/plain" }),
    ),
    Job.report(Report.file("unitSummary", ".effect-demo/reports/tests/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const integrationTests = baseJob("unit:integration-tests", "integration tests", "integration-tests", mode).pipe(
    Job.dependsOn("unit:build-application", "unit:unit-tests"),
    Job.input(
      Input.fromJob("buildManifest", "unit:build-application", "buildManifest"),
      Input.fromJob("coverageSummary", "unit:unit-tests", "coverageSummary"),
    ),
    Job.retry(Policy.retry({ maxAttempts: 2, baseDelayMillis: 1_000, maxDelayMillis: 2_000, jitter: "none" })),
    Job.artifact(
      Artifact.file("integrationJunit", ".effect-demo/artifacts/integration/junit.xml", { contentType: "application/xml" }),
      Artifact.file("integrationComposeLog", ".effect-demo/artifacts/integration/compose.log", { contentType: "text/plain" }),
    ),
    Job.report(Report.file("integrationSummary", ".effect-demo/reports/integration/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const securityScan = baseJob("unit:security-scan", "security scan", "security-scan", mode).pipe(
    Job.dependsOn("unit:build-application"),
    Job.input(Input.fromJob("buildManifest", "unit:build-application", "buildManifest")),
    Job.output(Output.file("riskLevel", ".effect-demo/outputs/security/risk-level.txt", { format: "text" })),
    Job.artifact(
      Artifact.file("sbom", ".effect-demo/artifacts/security/sbom.spdx.json", { contentType: "application/json" }),
      Artifact.file("vulnerabilityReport", ".effect-demo/artifacts/security/vuln-report.json", { contentType: "application/json" }),
    ),
    Job.report(Report.file("securitySummary", ".effect-demo/reports/security/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const packageRelease = baseJob("unit:package-release", "package release", "package-release", mode).pipe(
    Job.dependsOn("unit:prepare-context", "unit:build-application", "unit:integration-tests", "unit:security-scan"),
    Job.input(
      Input.fromJob("releaseContext", "unit:prepare-context", "releaseContext"),
      Input.fromJob("buildManifest", "unit:build-application", "buildManifest"),
      Input.fromJob("riskLevel", "unit:security-scan", "riskLevel"),
    ),
    Job.secret("REGISTRY_TOKEN"),
    Job.output(
      Output.file("releaseManifest", ".effect-demo/outputs/release/release-manifest.json", { format: "json" }),
      Output.file("imageDigest", ".effect-demo/outputs/release/image-digest.txt", { format: "text" }),
    ),
    Job.artifact(
      Artifact.file("publishBundle", ".effect-demo/artifacts/release/publish-bundle.json", { contentType: "application/json" }),
      Artifact.file("releaseNotes", ".effect-demo/artifacts/release/release-notes.md", { contentType: "text/markdown" }),
    ),
    Job.report(Report.file("releaseSummary", ".effect-demo/reports/release/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  return {
    prepareContext,
    staticAnalysis,
    buildApplication,
    unitTests,
    integrationTests,
    securityScan,
    packageRelease,
  }
}

const createManualJobs = () => {
  const common = createCommonJobs("manual")

  const performanceTests = baseJob("unit:performance-tests", "performance tests", "performance-tests", "manual").pipe(
    Job.dependsOn("unit:build-application"),
    Job.when(Condition.manual(), Condition.inputEquals("runPerformance", true)),
    Job.input(
      Input.fromJob("buildManifest", "unit:build-application", "buildManifest"),
      Input.fromWorkflow("forceTimeoutJob", "forceTimeoutJob"),
    ),
    Job.timeout(Policy.timeout(8)),
    Job.cancel(Policy.cancel("best-effort")),
    Job.artifact(
      Artifact.file("performanceSummary", ".effect-demo/artifacts/performance/k6-summary.json", { contentType: "application/json" }),
      Artifact.file("performanceLatencyCsv", ".effect-demo/artifacts/performance/latency.csv", { contentType: "text/csv" }),
    ),
    Job.report(Report.file("performanceReport", ".effect-demo/reports/performance/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const deployPreview = baseJob("unit:deploy-preview", "deploy preview", "deploy-preview", "manual").pipe(
    Job.dependsOn("unit:package-release"),
    Job.when(Condition.manual(), Condition.inputEquals("targetEnvironment", "preview")),
    Job.input(
      Input.fromJob("releaseManifest", "unit:package-release", "releaseManifest"),
      Input.fromWorkflow("targetEnvironment", "targetEnvironment"),
    ),
    Job.secret("DEPLOY_API_TOKEN"),
    Job.cancel(Policy.cancel("fail-fast")),
    Job.output(Output.file("previewUrl", ".effect-demo/outputs/deploy/preview-url.txt", { format: "text" })),
    Job.artifact(Artifact.file("deploymentLog", ".effect-demo/artifacts/deploy/deployment-log.json", { contentType: "application/json" })),
    Job.report(Report.file("deploySummary", ".effect-demo/reports/deploy/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const smokePreview = baseJob("unit:smoke-preview", "smoke preview", "smoke-preview", "manual").pipe(
    Job.dependsOn("unit:deploy-preview"),
    Job.when(Condition.upstreamStatus("unit:deploy-preview", "succeeded")),
    Job.input(
      Input.fromJob("previewUrl", "unit:deploy-preview", "previewUrl"),
      Input.fromWorkflow("failSmoke", "failSmoke"),
    ),
    Job.artifact(
      Artifact.file("smokeResults", ".effect-demo/artifacts/smoke/smoke-results.json", { contentType: "application/json" }),
      Artifact.file("smokeTrace", ".effect-demo/artifacts/smoke/http-trace.txt", { contentType: "text/plain" }),
    ),
    Job.report(Report.file("smokeSummary", ".effect-demo/reports/smoke/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const collectPreviewDiagnostics = baseJob(
    "unit:collect-preview-diagnostics",
    "collect preview diagnostics",
    "collect-preview-diagnostics",
    "manual",
  ).pipe(
    Job.dependsOn("unit:deploy-preview", "unit:smoke-preview"),
    Job.when(Condition.upstreamStatus("unit:smoke-preview", "failed")),
    Job.input(Input.fromJob("previewUrl", "unit:deploy-preview", "previewUrl")),
    Job.artifact(
      Artifact.file("previewDiagnostics", ".effect-demo/artifacts/diagnostics/preview-diagnostics.json", { contentType: "application/json" }),
      Artifact.file("incidentTimeline", ".effect-demo/artifacts/diagnostics/incident-timeline.md", { contentType: "text/markdown" }),
    ),
    Job.report(Report.file("diagnosticsSummary", ".effect-demo/reports/diagnostics/summary.md", { format: "text", contentType: "text/markdown" })),
  )

  return [
    common.prepareContext,
    common.staticAnalysis,
    common.buildApplication,
    common.unitTests,
    common.integrationTests,
    performanceTests,
    common.securityScan,
    common.packageRelease,
    deployPreview,
    smokePreview,
    collectPreviewDiagnostics,
  ]
}

const createGitHubJobs = () => {
  const common = createCommonJobs("github")

  const publishEdge = baseJob("unit:publish-edge", "publish edge", "publish", "github", {
    EFFECT_DEMO_PUBLISH_KIND: "edge",
  }).pipe(
    Job.dependsOn("unit:package-release"),
    Job.when(Condition.githubPush(), Condition.branch("main"), Condition.ref("refs/heads/main")),
    Job.input(Input.fromJob("releaseManifest", "unit:package-release", "releaseManifest")),
    Job.secret("REGISTRY_TOKEN"),
    Job.output(Output.file("publishTarget", ".effect-demo/outputs/publish/publish-target.txt", { format: "text" })),
    Job.artifact(Artifact.file("edgePublishMetadata", ".effect-demo/artifacts/publish/edge-publish.json", { contentType: "application/json" })),
    Job.report(Report.file("edgePublishSummary", ".effect-demo/reports/publish/edge-summary.md", { format: "text", contentType: "text/markdown" })),
  )

  const publishRelease = baseJob("unit:publish-release", "publish release", "publish", "github", {
    EFFECT_DEMO_PUBLISH_KIND: "release",
  }).pipe(
    Job.dependsOn("unit:package-release"),
    Job.when(Condition.githubPush(), Condition.tag("v-demo-release"), Condition.ref("refs/tags/v-demo-release")),
    Job.input(Input.fromJob("releaseManifest", "unit:package-release", "releaseManifest")),
    Job.secret("RELEASE_SIGNING_KEY"),
    Job.output(Output.file("signedReleaseId", ".effect-demo/outputs/publish/signed-release-id.txt", { format: "text" })),
    Job.artifact(Artifact.file("releaseSignoff", ".effect-demo/artifacts/publish/release-signoff.json", { contentType: "application/json" })),
    Job.report(Report.file("releasePublishSummary", ".effect-demo/reports/publish/release-summary.md", { format: "text", contentType: "text/markdown" })),
  )

  return [
    common.prepareContext,
    common.staticAnalysis,
    common.buildApplication,
    common.unitTests,
    common.integrationTests,
    common.securityScan,
    common.packageRelease,
    publishEdge,
    publishRelease,
  ]
}

export const createManualShowcaseWorkflow = () =>
  Workflow.make("workflow:effect-cicd-demo:manual").pipe(
    Workflow.named("Effect CI/CD Demo - Manual Showcase"),
    Workflow.metadata({
      owner: "demo",
      repository: "effect-cicd-demo",
      scenario: "manual-showcase",
      showcase: {
        focus: ["inputs", "retry", "conditions", "artifacts", "reports", "secrets", "preview deploy"],
      },
    }),
    Workflow.on(Trigger.manual()),
    Workflow.input(...manualInputs),
    Workflow.job(...createManualJobs()),
    Workflow.output(
      Output.fromJob("buildManifest", "unit:build-application", "buildManifest"),
      Output.fromJob("releaseManifest", "unit:package-release", "releaseManifest"),
      Output.fromJob("previewUrl", "unit:deploy-preview", "previewUrl"),
    ),
  )

export const createGitHubShowcaseWorkflow = () =>
  Workflow.make("workflow:effect-cicd-demo:github").pipe(
    Workflow.named("Effect CI/CD Demo - GitHub Showcase"),
    Workflow.metadata({
      owner: "demo",
      repository: "effect-cicd-demo",
      scenario: "github-showcase",
      showcase: {
        focus: ["github push", "branch and tag conditions", "retry", "release promotion", "signed publish"],
      },
    }),
    Workflow.on(Trigger.githubPush({ refs: ["refs/heads/main", "refs/tags/v-demo-release"] })),
    Workflow.job(...createGitHubJobs()),
    Workflow.output(
      Output.fromJob("buildManifest", "unit:build-application", "buildManifest"),
      Output.fromJob("releaseManifest", "unit:package-release", "releaseManifest"),
      Output.fromJob("publishTarget", "unit:publish-edge", "publishTarget"),
      Output.fromJob("signedReleaseId", "unit:publish-release", "signedReleaseId"),
    ),
  )
