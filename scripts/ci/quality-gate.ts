import { appendFileSync } from "node:fs";
import { formatJobResults, validateGate } from "./gate.ts";

let failureReason: string | undefined;
let details = "";
try {
  const needs: unknown = JSON.parse(process.env.CI_NEEDS ?? "null");
  details = formatJobResults(needs);
  const failures = validateGate(JSON.parse(process.env.CI_PLAN ?? "null"), needs, process.env.GITHUB_EVENT_NAME ?? "");
  if (failures.length) failureReason = "Required CI jobs did not complete successfully.";
} catch {
  failureReason = "CI plan or job results are missing or invalid.";
}
const summary =
  `## Quality Gate Result Inputs\n${details}\n` +
  (failureReason
    ? `## Quality Gate: FAILED\n${failureReason}\n`
    : "## Quality Gate: PASSED\nRequired jobs succeeded; only planned-unneeded jobs may be skipped.\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (failureReason) process.exitCode = 1;
