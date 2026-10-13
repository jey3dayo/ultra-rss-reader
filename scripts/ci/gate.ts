import { checkJobs, type Plan, requiredJobs } from "./plan.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePlan(value: unknown): Plan {
  if (
    !record(value) ||
    Object.keys(value).length !== 5 ||
    typeof value.full !== "boolean" ||
    typeof value.frontend !== "boolean" ||
    typeof value.native !== "boolean" ||
    typeof value.credentials !== "boolean" ||
    typeof value.windows !== "boolean"
  ) {
    throw new Error("Missing or invalid CI plan");
  }
  const plan = {
    full: value.full,
    frontend: value.frontend,
    native: value.native,
    credentials: value.credentials,
    windows: value.windows,
  };
  if (
    !plan.frontend ||
    (plan.full && !(plan.frontend && plan.native && plan.credentials && plan.windows)) ||
    (plan.credentials && !plan.native) ||
    (plan.native && !plan.windows)
  ) {
    throw new Error("Inconsistent CI plan");
  }
  return plan;
}

export function validateGate(planValue: unknown, needsValue: unknown, event: string): string[] {
  const failures: string[] = [];
  const plan = parsePlan(planValue);
  if (event !== "pull_request" && !plan.full) failures.push("Non-PR events require the full suite");
  if (!record(needsValue)) return ["Missing job results"];
  const planner = needsValue["change-plan"];
  if (!record(planner) || planner.result !== "success") failures.push("change-plan must succeed");
  const expected = requiredJobs(plan);
  for (const job of checkJobs) {
    const value = needsValue[job];
    const result = record(value) ? value.result : undefined;
    if (result !== "success" && !(result === "skipped" && expected[job] === false)) {
      failures.push(`${job}: ${String(result)} (${expected[job] ? "required" : "unneeded"})`);
    }
  }
  for (const job of Object.keys(needsValue)) {
    if (job !== "change-plan" && !Object.hasOwn(expected, job)) failures.push(`Unplanned job: ${job}`);
  }
  return failures;
}

export function formatJobResults(needs: unknown): string {
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
