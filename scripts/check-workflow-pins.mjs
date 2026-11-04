import fs from "node:fs";
import path from "node:path";

const errors = [];
const workflowsDir = process.env.WORKFLOW_PINS_WORKFLOWS_DIR ?? ".github/workflows";

function collectWorkflowPaths(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Required directory does not exist: ${directory}`);
  }
  if (!fs.statSync(directory).isDirectory()) {
    throw new Error(`Required path is not a directory: ${directory}`);
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => (entry.isFile() && /\.ya?ml$/.test(entry.name) ? [path.join(directory, entry.name)] : []))
    .sort();
}

const sourcePaths = collectWorkflowPaths(workflowsDir);

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

// actions.lock covers action references (checked by `mise run actions-lock:verify`);
// it does not lock cross-repository reusable workflow calls, so those stay SHA-pinned.
function isReusableWorkflowCall(usesValue) {
  return usesValue.includes("/.github/workflows/") && !usesValue.startsWith("./");
}

// A bare commit SHA is allowed only where no tag points at the pinned commit. `gh-actions-lock`
// keeps reporting `sha-as-ref` for these; that report is expected for exactly this table.
const bareShaActions = new Map([
  [
    "dtolnay/rust-toolchain",
    "pinned commit has no tag; the only tag, v1, is a moving major tag that points at a different commit",
  ],
]);

function splitUses(usesValue) {
  const atIndex = usesValue.lastIndexOf("@");
  return {
    actionPath: atIndex === -1 ? usesValue : usesValue.slice(0, atIndex),
    ref: atIndex === -1 ? "" : usesValue.slice(atIndex + 1),
  };
}

function checkReusableWorkflowRef(usesValue) {
  return /^[0-9a-f]{40}$/i.test(splitUses(usesValue).ref) ? null : "must use a 40-character commit SHA";
}

function checkActionRef(usesValue) {
  const { actionPath, ref } = splitUses(usesValue);
  if (/^v\d+(\.\d+){0,2}$/.test(ref)) {
    return null;
  }
  const ownerRepo = actionPath.split("/").slice(0, 2).join("/").toLowerCase();
  if (/^[0-9a-f]{40}$/i.test(ref) && bareShaActions.has(ownerRepo)) {
    return null;
  }
  return "must use a version tag recorded in actions.lock (a bare SHA is allowed only for actions listed in bareShaActions)";
}

function checkUses(usesValue) {
  if (usesValue.startsWith("./") || usesValue.startsWith("$/") || usesValue.startsWith("docker://")) {
    return null;
  }
  return isReusableWorkflowCall(usesValue) ? checkReusableWorkflowRef(usesValue) : checkActionRef(usesValue);
}

for (const sourcePath of sourcePaths) {
  const source = fs.readFileSync(sourcePath, "utf8");

  for (const { line, usesValue } of extractWorkflowUses(source)) {
    const problem = checkUses(usesValue);
    if (problem !== null) {
      errors.push(`${sourcePath}:${line}: ${usesValue} ${problem}`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}
