# effect-cicd-demo

This repository is a purpose-built demo project for `effect-cicd`.

It contains two workflows that share one realistic pipeline shape:

- `./.effect/workflows/manual-showcase.ts`
- `./.effect/workflows/github-showcase.ts`

The jobs create non-trivial logs, outputs, artifacts, and reports under `.effect-demo/` so the dashboard, API, and CLI have something meaningful to display.

## What This Demo Covers

- manual trigger
- GitHub push trigger
- multi-stage DAG with fan-in and fan-out
- workflow inputs
- unit inputs from workflow inputs and upstream outputs
- workflow outputs
- secrets
- retries
- timeout
- cancellation policy
- skipped jobs from conditions
- upstream status conditions
- logs, artifacts, and reports
- queueing and cancel/retry demos when multiple runs are submitted

## Workflows

### Manual showcase

Path:

```text
.effect/workflows/manual-showcase.ts
```

Main stages:

1. `prepare-context`
2. `static-analysis`
3. `build-application`
4. `unit-tests`
5. `integration-tests`
6. `performance-tests`
7. `security-scan`
8. `package-release`
9. `deploy-preview`
10. `smoke-preview`
11. `collect-preview-diagnostics`

Required manual inputs:

```json
{
  "releaseVersion": "1.4.0-demo.3",
  "targetEnvironment": "preview",
  "runPerformance": false,
  "injectIntegrationFlake": true,
  "failSmoke": false,
  "forceTimeoutJob": false
}
```

Behavior knobs:

- `injectIntegrationFlake: true` makes `integration-tests` fail once and succeed on retry
- `runPerformance: false` skips `performance-tests`
- `runPerformance: true` runs the performance stage
- `forceTimeoutJob: true` makes `performance-tests` exceed its unit timeout
- `targetEnvironment: "preview"` enables preview deploy and smoke stages
- `targetEnvironment: "staging"` skips preview deploy and downstream preview checks
- `failSmoke: true` makes `smoke-preview` fail and activates `collect-preview-diagnostics`

### GitHub showcase

Path:

```text
.effect/workflows/github-showcase.ts
```

Trigger:

- `refs/heads/main`
- `refs/tags/v-demo-release`

GitHub-specific stages:

- `publish-edge` runs on `refs/heads/main`
- `publish-release` runs on `refs/tags/v-demo-release`

The GitHub pipeline also forces a first-attempt integration flake so retry behavior is visible on push-triggered runs.

## Local App And Tests

Run the small app tests directly inside this repo:

```bash
bun test
```

Reset generated demo payloads:

```bash
bun run demo:clean
```

## Validate From effect-cicd

From the sibling `effect-cicd` repository:

```bash
bun run index.ts validate ../effect-cicd-demo/.effect/workflows/manual-showcase.ts
bun run index.ts validate ../effect-cicd-demo/.effect/workflows/github-showcase.ts
```

## Create A Local Project

There is no CLI command for local project creation yet, so use the dashboard or API.

Example API call against a running `effect-cicd` service:

```bash
curl -X POST http://127.0.0.1:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{
    "projectId": "project:effect-cicd-demo",
    "workflowModulePath": "../effect-cicd-demo/.effect/workflows/manual-showcase.ts",
    "workspacePath": "../effect-cicd-demo"
  }'
```

## Configure Secrets

From the `effect-cicd` repo, with the service running:

```bash
export ENGINE_BASE_URL=http://127.0.0.1:3000
export REGISTRY_TOKEN=demo-registry-token-2026
export DEPLOY_API_TOKEN=demo-preview-token-2026
export RELEASE_SIGNING_KEY=demo-signing-key-2026

bun run index.ts secrets set project:effect-cicd-demo REGISTRY_TOKEN --from-env REGISTRY_TOKEN
bun run index.ts secrets set project:effect-cicd-demo DEPLOY_API_TOKEN --from-env DEPLOY_API_TOKEN
bun run index.ts secrets set project:effect-cicd-demo RELEASE_SIGNING_KEY --from-env RELEASE_SIGNING_KEY
```

`REGISTRY_TOKEN` and `DEPLOY_API_TOKEN` are needed for the manual workflow happy path.

`RELEASE_SIGNING_KEY` is only needed for the GitHub tag demo.

## Manual Demo Scenarios

### Happy path with retry and preview deploy

```bash
ENGINE_BASE_URL=http://127.0.0.1:3000 bun run index.ts run ../effect-cicd-demo/.effect/workflows/manual-showcase.ts \
  --workspace ../effect-cicd-demo \
  --inputs '{
    "releaseVersion":"1.4.0-demo.3",
    "targetEnvironment":"preview",
    "runPerformance":false,
    "injectIntegrationFlake":true,
    "failSmoke":false,
    "forceTimeoutJob":false
  }'
```

What to show:

1. `integration-tests` fails once, schedules retry, then succeeds.
2. `performance-tests` is skipped.
3. `deploy-preview` and `smoke-preview` run.
4. `package-release` and `deploy-preview` logs contain redacted secrets.
5. Artifacts and reports exist for most jobs.

### Preview failure and diagnostics path

```bash
ENGINE_BASE_URL=http://127.0.0.1:3000 bun run index.ts run ../effect-cicd-demo/.effect/workflows/manual-showcase.ts \
  --workspace ../effect-cicd-demo \
  --inputs '{
    "releaseVersion":"1.4.0-demo.4",
    "targetEnvironment":"preview",
    "runPerformance":false,
    "injectIntegrationFlake":false,
    "failSmoke":true,
    "forceTimeoutJob":false
  }'
```

What to show:

1. `smoke-preview` fails.
2. `collect-preview-diagnostics` runs because of `upstreamStatus(smoke-preview, failed)`.
3. Diagnostics artifacts and reports appear only on the failure path.

### Timeout path

```bash
ENGINE_BASE_URL=http://127.0.0.1:3000 bun run index.ts run ../effect-cicd-demo/.effect/workflows/manual-showcase.ts \
  --workspace ../effect-cicd-demo \
  --inputs '{
    "releaseVersion":"1.4.0-demo.5",
    "targetEnvironment":"staging",
    "runPerformance":true,
    "injectIntegrationFlake":false,
    "failSmoke":false,
    "forceTimeoutJob":true
  }'
```

What to show:

1. `performance-tests` actually runs.
2. The job times out because the script intentionally sleeps too long.
3. The run ends in a timeout state.

### Queueing and cancel demo

1. Start the service with `MAX_CONCURRENT_RUNS=1` and `MAX_CONCURRENT_RUNS_PER_PROJECT=1`.
2. Submit two manual runs back-to-back.
3. Observe one queued run and one active run.
4. Cancel the active run while `deploy-preview` is still progressing.
5. Retry the canceled or failed run from the dashboard or CLI.

## GitHub Demo Scenarios

Create a GitHub binding that points at:

```text
../effect-cicd-demo/.effect/workflows/github-showcase.ts
```

### Main branch push

Use a webhook payload with:

```text
refs/heads/main
```

Expected behavior:

- shared pipeline runs
- `integration-tests` retries once
- `publish-edge` runs
- `publish-release` is skipped

### Release tag push

Use a webhook payload with:

```text
refs/tags/v-demo-release
```

Expected behavior:

- shared pipeline runs
- `publish-edge` is skipped
- `publish-release` runs
- tag path exercises the signing secret

## Generated Payload Layout

Run data is written into `.effect-demo/` inside the workspace:

- `.effect-demo/outputs/`
- `.effect-demo/artifacts/`
- `.effect-demo/reports/`
- `.effect-demo/state/`

That keeps the repo clean while still producing realistic file-backed outputs for the engine to capture.
