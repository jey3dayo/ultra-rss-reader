import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { validateReleaseAssetInventory } from "../release-artifact-contract.ts";

export const ghOutput = (args: readonly string[]): string => {
  const result = spawnSync("gh", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.error || result.status !== 0) {
    throw new Error(`gh ${args[0] ?? "command"} failed (exit ${result.status ?? "unavailable"})`);
  }
  return result.stdout ?? "";
};

export const ghJson = (args: readonly string[]): unknown => {
  try {
    return JSON.parse(ghOutput(args));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("gh ")) {
      throw error;
    }
    throw new Error(`gh ${args[0] ?? "command"} returned invalid JSON`);
  }
};

export const gitShow = (args: readonly string[]): string => {
  const result = spawnSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.error || result.status !== 0) {
    throw new Error("could not read the updater key from the expected source commit");
  }
  return result.stdout ?? "";
};

export const resolveOutputRoot = (requestedRoot: string, workingDirectory = process.cwd()): string => {
  const repositoryRoot = realpathSync(workingDirectory);
  const outputRoot = path.resolve(repositoryRoot, requestedRoot);
  const relativeOutput = path.relative(path.join(repositoryRoot, "tmp"), outputRoot);
  if (
    !relativeOutput ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeOutput)
  ) {
    throw new Error("output-root must be a new child directory under the repository tmp directory");
  }
  let cursor = repositoryRoot;
  for (const segment of path.relative(repositoryRoot, outputRoot).split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      if (lstatSync(cursor).isSymbolicLink()) {
        throw new Error("output-root cannot pass through a symbolic link");
      }
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
  if (existsSync(outputRoot)) {
    throw new Error(`output-root already exists: ${outputRoot}`);
  }
  return outputRoot;
};

export const createOutputRoot = (requestedRoot: string, workingDirectory = process.cwd()): string => {
  const repositoryRoot = realpathSync(workingDirectory);
  const preflight = resolveOutputRoot(requestedRoot, repositoryRoot);
  let cursor = repositoryRoot;
  for (const segment of path.relative(repositoryRoot, path.dirname(preflight)).split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const status = lstatSync(cursor);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error("output-root ancestors must be real directories");
      }
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      mkdirSync(cursor);
      const created = lstatSync(cursor);
      if (created.isSymbolicLink() || !created.isDirectory()) {
        throw new Error("output-root ancestors must be real directories");
      }
    }
  }
  const verified = resolveOutputRoot(preflight, repositoryRoot);
  mkdirSync(verified);
  return verified;
};

export const downloadRelease = (tag: string, outputRoot: string): void => {
  const result = spawnSync("gh", ["release", "download", tag, "--dir", outputRoot], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(`gh release download failed (exit ${result.status ?? "unavailable"})`);
  }
};

export const downloadFiles = (outputRoot: string, tag: string): Map<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  for (const entry of readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isFile()) {
      throw new Error(`download output contains a non-file entry ${entry.name}`);
    }
    files.set(entry.name, readFileSync(path.join(outputRoot, entry.name)));
  }
  validateReleaseAssetInventory(tag, [...files.keys()]);
  return files;
};
