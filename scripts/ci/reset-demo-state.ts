import { divider, log, resetDemoState } from "./_common.ts"

divider("Reset Demo State")
await resetDemoState()
log("Removed .effect-demo workspace outputs, artifacts, reports, and transient state")
