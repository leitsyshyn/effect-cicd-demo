import { Artifact, Command, Job, Report, Trigger, Workflow } from "@effect-cicd/dsl"

export default Workflow.make("workflow:effect-cicd-demo:quickstart").pipe(
  Workflow.named("Effect CI/CD Demo - Quickstart"),
  Workflow.on(Trigger.manual()),
  Workflow.job(
    Job.make("unit:quickstart").pipe(
      Job.named("quickstart"),
      Job.image("oven/bun:1"),
      Job.exec(Command.argv("bun", ["run", "scripts/ci/quickstart.ts"])),
      Job.env({ CI: "true" }),
      Job.workingDirectory("."),
      Job.artifact(
        Artifact.file("hello", ".effect-demo/artifacts/quickstart/hello.json", { contentType: "application/json" }),
      ),
      Job.report(
        Report.file("summary", ".effect-demo/reports/quickstart/summary.txt", { contentType: "text/plain" }),
      ),
    ),
  ),
)
