import fs from "node:fs";
import path from "node:path";

const errors = [];
const workflowsDir = process.env.WORKFLOW_PINS_WORKFLOWS_DIR ?? ".github/workflows";
const workflowPaths = fs
  .readdirSync(workflowsDir)
  .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
  .map((fileName) => path.join(workflowsDir, fileName))
  .sort();

function readYamlScalar(rest) {
  const trimmed = rest.trimStart();
  const quote = trimmed[0];
  if (quote === "'" || quote === '"') {
    const closeIndex = trimmed.indexOf(quote, 1);
    if (closeIndex < 0) {
      return trimmed.slice(1);
    }
    return trimmed.slice(1, closeIndex);
  }

  return trimmed.split(/\s+#/, 1)[0]?.trimEnd() ?? "";
}

function extractWorkflowUses(workflow) {
  return workflow.split(/\r?\n/).flatMap((line, index) => {
    const rest = line.match(/^\s*(?:-\s+)?uses:\s*(?<rest>.+)$/)?.groups?.rest;
    if (!rest) {
      return [];
    }
    return [{ line: index + 1, usesValue: readYamlScalar(rest) }];
  });
}

function shouldRequirePinnedRef(usesValue) {
  return !usesValue.startsWith("./") && !usesValue.startsWith("../");
}

for (const workflowPath of workflowPaths) {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  for (const { line, usesValue } of extractWorkflowUses(workflow)) {
    if (!shouldRequirePinnedRef(usesValue)) {
      continue;
    }

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
