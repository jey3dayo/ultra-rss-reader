import { appendFileSync } from "node:fs";
import { validateGate } from "./gate.ts";

const failures = validateGate(
  JSON.parse(process.env.CI_PLAN ?? "null"),
  JSON.parse(process.env.CI_NEEDS ?? "null"),
  process.env.GITHUB_EVENT_NAME ?? "",
);
const summary =
  `## Quality Gate Result Inputs\n${process.env.CI_NEEDS ?? "missing"}\n\n` +
  (failures.length
    ? `## Quality Gate: FAILED\n${failures.join("\n")}\n`
    : "## Quality Gate: PASSED\nRequired jobs succeeded; only planned-unneeded jobs may be skipped.\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (failures.length) process.exitCode = 1;
