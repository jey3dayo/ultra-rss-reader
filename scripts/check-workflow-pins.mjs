import fs from "node:fs";
import path from "node:path";

const usesPattern = /^\s*-\s+uses:\s+([^\s#]+)$/gm;
const errors = [];
const workflowsDir = ".github/workflows";
const workflowPaths = fs
  .readdirSync(workflowsDir)
  .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
  .map((fileName) => path.join(workflowsDir, fileName))
  .sort();

for (const workflowPath of workflowPaths) {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  for (const match of workflow.matchAll(usesPattern)) {
    const usesValue = match[1];
    const line = workflow.slice(0, match.index).split("\n").length;
    const atIndex = usesValue.lastIndexOf("@");
    const ref = atIndex === -1 ? "" : usesValue.slice(atIndex + 1);

    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      errors.push(`${workflowPath}:${line}: ${usesValue} must use a 40-character commit SHA`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}
