import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const scripts = readdirSync("scripts/ci")
  .filter((name) => name.endsWith(".sh"))
  .toSorted()
  .map((name) => `scripts/ci/${name}`);
if (scripts.length === 0) throw new Error("No CI shell scripts found");
execFileSync("shellcheck", scripts, { stdio: "inherit" });
