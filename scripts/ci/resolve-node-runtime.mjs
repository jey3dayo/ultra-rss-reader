import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function nodeRuntimeFromPackageJson(packageJson) {
  if (typeof packageJson !== "object" || packageJson === null || Array.isArray(packageJson)) {
    throw new Error("package.json must contain an object");
  }

  const engines = packageJson.engines;
  if (typeof engines !== "object" || engines === null || Array.isArray(engines)) {
    throw new Error("package.json must define engines.node");
  }

  const version = engines.node;
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("package.json engines.node must be an exact x.y.z version");
  }

  return `node@${version}`;
}

function writeNodeRuntimeOutput() {
  const workspace = process.env.GITHUB_WORKSPACE;
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!workspace || !outputFile) {
    throw new Error("GITHUB_WORKSPACE and GITHUB_OUTPUT are required");
  }

  const packageJson = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));
  const runtime = nodeRuntimeFromPackageJson(packageJson);
  appendFileSync(outputFile, `runtime=${runtime}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeNodeRuntimeOutput();
}
