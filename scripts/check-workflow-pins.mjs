import fs from "node:fs";
import path from "node:path";

const errors = [];
const workflowsDir = process.env.WORKFLOW_PINS_WORKFLOWS_DIR ?? ".github/workflows";
const hasActionsDirOverride = process.env.WORKFLOW_PINS_ACTIONS_DIR !== undefined;
const actionsDir = process.env.WORKFLOW_PINS_ACTIONS_DIR ?? ".github/actions";

function collectYamlPaths(directory, recursive = false, optional = false) {
  if (!fs.existsSync(directory)) {
    if (optional) {
      return [];
    }
    throw new Error(`Required directory does not exist: ${directory}`);
  }
  if (!fs.statSync(directory).isDirectory()) {
    throw new Error(`Required path is not a directory: ${directory}`);
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive) {
        return collectYamlPaths(entryPath, recursive);
      }
      return entry.isFile() && /\.ya?ml$/.test(entry.name) ? [entryPath] : [];
    })
    .sort();
}

const sourcePaths = [
  ...collectYamlPaths(workflowsDir),
  ...collectYamlPaths(actionsDir, true, !hasActionsDirOverride),
].sort();

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

for (const sourcePath of sourcePaths) {
  const source = fs.readFileSync(sourcePath, "utf8");

  for (const { line, usesValue } of extractWorkflowUses(source)) {
    if (!shouldRequirePinnedRef(usesValue)) {
      continue;
    }

    const atIndex = usesValue.lastIndexOf("@");
    const ref = atIndex === -1 ? "" : usesValue.slice(atIndex + 1);

    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      errors.push(`${sourcePath}:${line}: ${usesValue} must use a 40-character commit SHA`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}
