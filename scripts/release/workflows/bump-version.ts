import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  prepareVersionChanges,
  type VersionChange,
  type VersionSources,
  validateStableVersion,
} from "../lib/version-bump.ts";

type WriteChange = Pick<VersionChange, "path" | "original" | "updated">;
type PreparedChange = WriteChange & {
  temporaryDirectory: string;
  temporaryPath: string;
};
type RenameFile = (source: string, target: string) => void;

const usage = "Usage: node scripts/release/bump-version.ts <X.Y.Z> [--check]";

const fail = (message: string): never => {
  throw new Error(`${message}\n\n${usage}`);
};

const versionSourcesAt = (root: string): VersionSources => ({
  packageJson: readFileSync(join(root, "package.json"), "utf8"),
  cargoToml: readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8"),
  cargoLock: readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8"),
  tauriConfig: readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"),
  msixManifest: readFileSync(join(root, "msix/Package.appxmanifest"), "utf8"),
});

const parseArguments = (args: readonly string[]): { targetVersion: string; checkOnly: boolean } => {
  const checkOnly = args.includes("--check");
  const positionalArgs = args.filter((arg) => arg !== "--check");
  if (positionalArgs.length !== 1 || args.some((arg) => arg.startsWith("-") && arg !== "--check")) {
    return fail("expected exactly one stable semantic version");
  }

  const targetVersion = positionalArgs[0];
  if (targetVersion === undefined) {
    return fail("expected exactly one stable semantic version");
  }
  try {
    validateStableVersion(targetVersion);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  return { targetVersion, checkOnly };
};

const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const prepareChange = (change: WriteChange): PreparedChange => {
  const temporaryDirectory = mkdtempSync(join(dirname(change.path), ".bump-version-"));
  const temporaryPath = join(temporaryDirectory, basename(change.path));
  return { ...change, temporaryDirectory, temporaryPath };
};

const writeRestoreFile = (change: PreparedChange, restoreDirectory: string): void => {
  const restorePath = join(restoreDirectory, basename(change.path));
  writeFileSync(restorePath, change.original, "utf8");
  renameSync(restorePath, change.path);
};

// Restores committed files newest-first and returns one message per failed restore.
const rollbackCommitted = (committed: readonly PreparedChange[]): string[] => {
  const rollbackErrors: string[] = [];
  for (const change of [...committed].reverse()) {
    let restoreDirectory: string | undefined;
    try {
      restoreDirectory = mkdtempSync(join(dirname(change.path), ".bump-version-"));
      writeRestoreFile(change, restoreDirectory);
    } catch (rollbackError) {
      rollbackErrors.push(`${change.path}: ${describeError(rollbackError)}`);
    } finally {
      if (restoreDirectory) {
        rmSync(restoreDirectory, { recursive: true, force: true });
      }
    }
  }
  return rollbackErrors;
};

export const writeChanges = (changes: readonly WriteChange[], renameFile: RenameFile = renameSync): void => {
  const prepared: PreparedChange[] = [];
  const committed: PreparedChange[] = [];

  try {
    for (const change of changes.filter(({ updated, original }) => updated !== original)) {
      const preparedChange = prepareChange(change);
      prepared.push(preparedChange);
      writeFileSync(preparedChange.temporaryPath, change.updated, "utf8");
    }

    for (const change of prepared) {
      renameFile(change.temporaryPath, change.path);
      committed.push(change);
    }
  } catch (error) {
    const rollbackErrors = rollbackCommitted(committed);
    const rollbackMessage = rollbackErrors.length > 0 ? `; rollback failures: ${rollbackErrors.join("; ")}` : "";
    throw new Error(`version update failed: ${describeError(error)}${rollbackMessage}`);
  } finally {
    for (const change of prepared) {
      rmSync(change.temporaryDirectory, { recursive: true, force: true });
    }
  }
};

export const run = (args: readonly string[], root = "."): string[] => {
  const { targetVersion, checkOnly } = parseArguments(args);
  const changes = prepareVersionChanges(targetVersion, versionSourcesAt(root));
  const currentVersion = changes.find(({ path }) => path === "package.json")?.currentVersion;

  if (!currentVersion) {
    throw new Error("package.json version is missing");
  }

  if (currentVersion === targetVersion) {
    return [`All version files already use ${targetVersion}.`];
  }

  if (checkOnly) {
    return [
      `Would update ${changes.length} version files: ${currentVersion} -> ${targetVersion}`,
      ...changes.map((change) => `- ${change.path}: ${change.currentVersion} -> ${change.formatTarget(targetVersion)}`),
    ];
  }

  writeChanges(changes.map((change) => ({ ...change, path: join(root, change.path) })));
  return [`Updated ${changes.length} version files: ${currentVersion} -> ${targetVersion}`];
};
