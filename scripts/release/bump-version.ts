import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

type VersionFile = {
  path: string;
  readVersion: (source: string) => string;
  update: (source: string, targetVersion: string) => string;
  formatTarget: (targetVersion: string) => string;
};

type VersionChange = VersionFile & {
  currentVersion: string;
  original: string;
  updated: string;
};

type WriteChange = Pick<VersionChange, "path" | "original" | "updated">;

type PreparedChange = WriteChange & {
  temporaryDirectory: string;
  temporaryPath: string;
};

type RenameFile = (source: string, target: string) => void;

const usage = "Usage: node scripts/release/bump-version.ts <X.Y.Z> [--check]";
const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MSIX_VERSION_COMPONENT_MAX = 65_535;
const CARGO_PACKAGE_SECTION_PATTERN = /^\[package\]$/gm;
const CARGO_TOML_VERSION_PATTERN = /^version = "([^"]+)"$/gm;
const CARGO_LOCK_PACKAGE_SECTION_PATTERN = /^\[\[package\]\]\s*$/gm;
const CARGO_LOCK_NAME_PATTERN = /^name\s*=\s*"([^"]+)"\s*$/gm;
const CARGO_LOCK_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"\s*$/gm;
const MSIX_IDENTITY_PATTERN = /<Identity\b[^>]*\/>/g;
const MSIX_IDENTITY_VERSION_PATTERN = /\bVersion="([^"]+)"/g;

const fail = (message: string): never => {
  throw new Error(`${message}\n\n${usage}`);
};

const parseStableVersion = (version: string): readonly number[] => {
  const match = stableVersionPattern.exec(version);
  if (!match) {
    return fail(`invalid stable semantic version: ${version}`);
  }

  const components = match.slice(1).map(Number);
  if (components.some((component) => component > MSIX_VERSION_COMPONENT_MAX)) {
    return fail(`version components must not exceed ${MSIX_VERSION_COMPONENT_MAX} for MSIX: ${version}`);
  }

  return components;
};

type JsonVersionOwner = {
  start: number;
  end: number;
  version: string;
};

const readJsonString = (source: string, start: number): { value: string; start: number; end: number } => {
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === '"') {
      const parsed = JSON.parse(source.slice(start, index + 1));
      if (typeof parsed !== "string") throw new Error("JSON string token is not a string");
      return { value: parsed, start, end: index + 1 };
    }
  }
  throw new Error("unterminated JSON string");
};

const readJsonVersionOwners = (source: string): JsonVersionOwner[] => {
  const owners: JsonVersionOwner[] = [];
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const key = readJsonString(source, index);
      if (depth === 1 && key.value === "version") {
        let valueStart = key.end;
        while (/\s/.test(source[valueStart] ?? "")) {
          valueStart += 1;
        }
        if (source[valueStart] !== ":") {
          index = key.end - 1;
          continue;
        }
        valueStart += 1;
        while (/\s/.test(source[valueStart] ?? "")) {
          valueStart += 1;
        }
        if (source[valueStart] !== '"') {
          throw new Error("JSON version owner must be a string");
        }
        const value = readJsonString(source, valueStart);
        owners.push({ start: value.start, end: value.end, version: value.value });
        index = value.end - 1;
      } else {
        index = key.end - 1;
      }
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
    }
  }

  return owners;
};

const readJsonVersionOwner = (source: string, path: string): JsonVersionOwner => {
  const owners = readJsonVersionOwners(source);
  if (owners.length !== 1) {
    throw new Error(`expected exactly one version owner in ${path}, found ${owners.length}`);
  }
  return owners[0];
};

const jsonVersionFile = (path: string): VersionFile => ({
  path,
  readVersion: (source) => readJsonVersionOwner(source, path).version,
  update: (source, targetVersion) => {
    const owner = readJsonVersionOwner(source, path);
    return `${source.slice(0, owner.start)}"${targetVersion}"${source.slice(owner.end)}`;
  },
  formatTarget: (targetVersion) => targetVersion,
});

const readCargoLockOwner = (source: string): { element: string; start: number; version: string } => {
  const sectionMatches = [...source.matchAll(CARGO_LOCK_PACKAGE_SECTION_PATTERN)];
  const owners: Array<{ element: string; start: number; version: string }> = [];

  for (const [sectionIndex, sectionMatch] of sectionMatches.entries()) {
    const sectionStart = (sectionMatch.index ?? 0) + sectionMatch[0].length;
    const nextSectionStart = sectionMatches[sectionIndex + 1]?.index ?? source.length;
    const packageSection = source.slice(sectionStart, nextSectionStart);
    const names = [...packageSection.matchAll(CARGO_LOCK_NAME_PATTERN)];
    if (!names.some((name) => name[1] === "ultra-rss-reader")) {
      continue;
    }

    const versions = [...packageSection.matchAll(CARGO_LOCK_VERSION_PATTERN)];
    if (names.length !== 1 || versions.length !== 1) {
      throw new Error(
        `expected exactly one name and version in the ultra-rss-reader Cargo.lock package entry, found ${names.length} names and ${versions.length} versions`,
      );
    }
    owners.push({
      element: versions[0][0],
      start: sectionStart + (versions[0].index ?? 0),
      version: versions[0][1],
    });
  }

  if (owners.length !== 1) {
    throw new Error(`expected exactly one ultra-rss-reader Cargo.lock package entry, found ${owners.length}`);
  }
  return owners[0];
};

const cargoLockVersionFile: VersionFile = {
  path: "src-tauri/Cargo.lock",
  readVersion: (source) => readCargoLockOwner(source).version,
  update: (source, targetVersion) => {
    const owner = readCargoLockOwner(source);
    const updatedElement = owner.element.replace(/(version\s*=\s*")[^"]+("\s*)$/, `$1${targetVersion}$2`);
    return `${source.slice(0, owner.start)}${updatedElement}${source.slice(owner.start + owner.element.length)}`;
  },
  formatTarget: (targetVersion) => targetVersion,
};

const readCargoTomlOwner = (source: string): { element: string; start: number; version: string } => {
  const sectionMatches = [...source.matchAll(CARGO_PACKAGE_SECTION_PATTERN)];
  if (sectionMatches.length !== 1) {
    throw new Error(`expected exactly one Cargo.toml [package] section, found ${sectionMatches.length}`);
  }

  const sectionMatch = sectionMatches[0];
  const sectionStart = (sectionMatch.index ?? 0) + sectionMatch[0].length;
  const nextSectionOffset = source.slice(sectionStart).search(/^\[/m);
  const sectionEnd = nextSectionOffset === -1 ? source.length : sectionStart + nextSectionOffset;
  const packageSection = source.slice(sectionStart, sectionEnd);
  const versionMatches = [...packageSection.matchAll(CARGO_TOML_VERSION_PATTERN)];
  if (versionMatches.length !== 1) {
    throw new Error(`expected exactly one Cargo.toml package version owner, found ${versionMatches.length}`);
  }

  const versionMatch = versionMatches[0];
  return {
    element: versionMatch[0],
    start: sectionStart + (versionMatch.index ?? 0),
    version: versionMatch[1],
  };
};

const cargoTomlVersionFile: VersionFile = {
  path: "src-tauri/Cargo.toml",
  readVersion: (source) => readCargoTomlOwner(source).version,
  update: (source, targetVersion) => {
    const owner = readCargoTomlOwner(source);
    const updatedElement = owner.element.replace(CARGO_TOML_VERSION_PATTERN, `version = "${targetVersion}"`);
    return `${source.slice(0, owner.start)}${updatedElement}${source.slice(owner.start + owner.element.length)}`;
  },
  formatTarget: (targetVersion) => targetVersion,
};

const readMsixIdentity = (source: string): { element: string; start: number; version: string } => {
  const identityMatches = [...source.matchAll(MSIX_IDENTITY_PATTERN)];
  if (identityMatches.length !== 1) {
    throw new Error(`expected exactly one MSIX Identity element, found ${identityMatches.length}`);
  }

  const identityMatch = identityMatches[0];
  const element = identityMatch[0];
  const versionMatches = [...element.matchAll(MSIX_IDENTITY_VERSION_PATTERN)];
  if (versionMatches.length !== 1) {
    throw new Error(
      `expected exactly one Version attribute in the MSIX Identity element, found ${versionMatches.length}`,
    );
  }

  return {
    element,
    start: identityMatch.index ?? 0,
    version: versionMatches[0][1],
  };
};

const msixVersionFile: VersionFile = {
  path: "msix/Package.appxmanifest",
  readVersion: (source) => readMsixIdentity(source).version,
  update: (source, targetVersion) => {
    const identity = readMsixIdentity(source);
    const updatedElement = identity.element.replace(MSIX_IDENTITY_VERSION_PATTERN, `Version="${targetVersion}.0"`);
    return `${source.slice(0, identity.start)}${updatedElement}${source.slice(identity.start + identity.element.length)}`;
  },
  formatTarget: (targetVersion) => `${targetVersion}.0`,
};

const versionFiles: readonly VersionFile[] = [
  jsonVersionFile("package.json"),
  cargoTomlVersionFile,
  cargoLockVersionFile,
  jsonVersionFile("src-tauri/tauri.conf.json"),
  msixVersionFile,
];

const parseArguments = (args: readonly string[]): { targetVersion: string; checkOnly: boolean } => {
  const checkOnly = args.includes("--check");
  const positionalArgs = args.filter((arg) => arg !== "--check");
  if (positionalArgs.length !== 1 || args.some((arg) => arg.startsWith("-") && arg !== "--check")) {
    return fail("expected exactly one stable semantic version");
  }

  const targetVersion = positionalArgs[0];
  parseStableVersion(targetVersion);
  return { targetVersion, checkOnly };
};

const readVersionChanges = (targetVersion: string): VersionChange[] => {
  const changes = versionFiles.map((versionFile) => {
    const original = readFileSync(versionFile.path, "utf8");
    const currentVersion = versionFile.readVersion(original);
    const updated = versionFile.update(original, targetVersion);
    return { ...versionFile, currentVersion, original, updated };
  });

  const packageVersion = changes.find(({ path }) => path === "package.json")?.currentVersion;
  if (!packageVersion) {
    throw new Error("package.json version is missing");
  }

  const mismatches = changes.filter(
    ({ currentVersion, formatTarget }) => currentVersion !== formatTarget(packageVersion),
  );
  if (mismatches.length > 0) {
    throw new Error(`version drift detected before bump: ${mismatches.map(({ path }) => path).join(", ")}`);
  }

  return changes;
};

export const writeChanges = (changes: readonly WriteChange[], renameFile: RenameFile = renameSync): void => {
  const prepared: PreparedChange[] = [];
  const committed: PreparedChange[] = [];

  try {
    for (const change of changes) {
      if (change.updated === change.original) {
        continue;
      }

      const temporaryDirectory = mkdtempSync(join(dirname(change.path), ".bump-version-"));
      const temporaryPath = join(temporaryDirectory, basename(change.path));
      const preparedChange = { ...change, temporaryDirectory, temporaryPath };
      prepared.push(preparedChange);
      writeFileSync(temporaryPath, change.updated, "utf8");
    }

    for (const change of prepared) {
      renameFile(change.temporaryPath, change.path);
      committed.push(change);
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const change of [...committed].reverse()) {
      let restoreDirectory: string | undefined;
      try {
        restoreDirectory = mkdtempSync(join(dirname(change.path), ".bump-version-"));
        const restorePath = join(restoreDirectory, basename(change.path));
        writeFileSync(restorePath, change.original, "utf8");
        renameSync(restorePath, change.path);
      } catch (rollbackError) {
        rollbackErrors.push(
          `${change.path}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      } finally {
        if (restoreDirectory) {
          rmSync(restoreDirectory, { recursive: true, force: true });
        }
      }
    }

    const originalError = error instanceof Error ? error.message : String(error);
    const rollbackMessage = rollbackErrors.length > 0 ? `; rollback failures: ${rollbackErrors.join("; ")}` : "";
    throw new Error(`version update failed: ${originalError}${rollbackMessage}`);
  } finally {
    for (const change of prepared) {
      rmSync(change.temporaryDirectory, { recursive: true, force: true });
    }
  }
};

const run = (args: readonly string[]): void => {
  const { targetVersion, checkOnly } = parseArguments(args);
  const changes = readVersionChanges(targetVersion);
  const currentVersion = changes.find(({ path }) => path === "package.json")?.currentVersion;

  if (!currentVersion) {
    throw new Error("package.json version is missing");
  }

  if (currentVersion === targetVersion) {
    console.log(`All version files already use ${targetVersion}.`);
    return;
  }

  if (checkOnly) {
    console.log(`Would update ${changes.length} version files: ${currentVersion} -> ${targetVersion}`);
    for (const change of changes) {
      console.log(`- ${change.path}: ${change.currentVersion} -> ${change.formatTarget(targetVersion)}`);
    }
    return;
  }

  writeChanges(changes);
  console.log(`Updated ${changes.length} version files: ${currentVersion} -> ${targetVersion}`);
};

const isMainModule = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
