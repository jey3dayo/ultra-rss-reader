import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { detectPlan } from "./plan.ts";

const plan = detectPlan(process.env.GITHUB_EVENT_NAME ?? "", () => {
  const base = process.env.PR_BASE_SHA;
  const head = process.env.PR_HEAD_SHA;
  if (!base || !head || !/^[a-f0-9]{40}$/.test(base) || !/^[a-f0-9]{40}$/.test(head)) {
    throw new Error("Missing PR base/head commit SHA");
  }
  return execFileSync("git", ["diff", "--name-status", "-z", "--find-renames", `${base}...${head}`, "--"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
});
const outputs = {
  plan: JSON.stringify(plan),
  frontend: String(plan.frontend),
  native: String(plan.native),
  credentials: String(plan.credentials),
  full: String(plan.full),
  frontend_os: JSON.stringify(plan.windows ? ["ubuntu-latest", "windows-latest"] : ["ubuntu-latest"]),
};
if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
appendFileSync(
  process.env.GITHUB_OUTPUT,
  Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}\n`)
    .join(""),
);
console.log(JSON.stringify(outputs));
