import { appendFileSync } from "node:fs";
import { validateGate } from "./gate.ts";
import { checkJobs } from "./plan.ts";

function jobResults(needs: unknown): string {
  const entries: [string, unknown][] =
    typeof needs === "object" && needs !== null && !Array.isArray(needs) ? Object.entries(needs) : [];
  const allowed = new Set(["success", "failure", "cancelled", "skipped", "missing", "invalid"]);
  return ["change-plan", ...checkJobs]
    .map((job) => {
      const entry = entries.find(([name]) => name === job)?.[1];
      const result = typeof entry === "object" && entry !== null && "result" in entry ? entry.result : undefined;
      const status =
        typeof result === "string" && allowed.has(result) ? result : result === undefined ? "missing" : "invalid";
      return `- ${job}: ${status}\n`;
    })
    .join("");
}

let failureReason: string | undefined;
let details = "";
try {
  const needs: unknown = JSON.parse(process.env.CI_NEEDS ?? "null");
  const failures = validateGate(JSON.parse(process.env.CI_PLAN ?? "null"), needs, process.env.GITHUB_EVENT_NAME ?? "");
  details = jobResults(needs);
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
