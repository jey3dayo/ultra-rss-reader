import {
  findCargoLockPackageVersionOwners,
  findMsixIdentityVersionOwners,
  findTopLevelJsonVersionOwners,
  MSIX_VERSION_COMPONENT_MAX,
  STABLE_VERSION_PATTERN,
} from "./version-owners.ts";

type VersionSourceKey = "packageJson" | "cargoToml" | "cargoLock" | "tauriConfig" | "msixManifest";

export type VersionSources = Record<VersionSourceKey, string>;

export type VersionChange = {
  currentVersion: string;
  formatTarget: (targetVersion: string) => string;
  original: string;
  path: string;
  updated: string;
};

const CARGO_PACKAGE_SECTION_PATTERN = /^\[package\]$/gm;
const CARGO_TOML_VERSION_PATTERN = /^version = "([^"]+)"$/gm;

export const validateStableVersion = (version: string): void => {
  const match = STABLE_VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`invalid stable semantic version: ${version}`);
  }

  const components = match.slice(1).map(Number);
  if (components.some((component) => component > MSIX_VERSION_COMPONENT_MAX)) {
    throw new Error(`version components must not exceed ${MSIX_VERSION_COMPONENT_MAX} for MSIX: ${version}`);
  }
};

const requireSingleJsonVersionOwner = (source: string, path: string) => {
  const owners = findTopLevelJsonVersionOwners(source);
  if (owners.length !== 1) {
    throw new Error(`expected exactly one version owner in ${path}, found ${owners.length}`);
  }
  return owners[0];
};

const jsonVersionFile = (path: string, sourceKey: VersionSourceKey) => ({
  formatTarget: (targetVersion: string) => targetVersion,
  path,
  readVersion: (source: string) => requireSingleJsonVersionOwner(source, path).version,
  sourceKey,
  update: (source: string, targetVersion: string) => {
    const owner = requireSingleJsonVersionOwner(source, path);
    return `${source.slice(0, owner.start)}"${targetVersion}"${source.slice(owner.end)}`;
  },
});

const readCargoLockOwner = (source: string) => {
  const owners = findCargoLockPackageVersionOwners(source);
  if (owners.length !== 1) {
    throw new Error(`expected exactly one ultra-rss-reader Cargo.lock package entry, found ${owners.length}`);
  }

  const owner = owners[0];
  if (owner.nameCount !== 1 || owner.versions.length !== 1) {
    throw new Error(
      `expected exactly one name and version in the ultra-rss-reader Cargo.lock package entry, found ${owner.nameCount} names and ${owner.versions.length} versions`,
    );
  }
  return owner.versions[0];
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

const readMsixOwner = (source: string) => {
  const identities = findMsixIdentityVersionOwners(source);
  if (identities.length !== 1) {
    throw new Error(`expected exactly one MSIX Identity element, found ${identities.length}`);
  }

  const identity = identities[0];
  if (identity.versions.length !== 1) {
    throw new Error(
      `expected exactly one Version attribute in the MSIX Identity element, found ${identity.versions.length}`,
    );
  }
  return identity.versions[0];
};

const versionFiles = [
  jsonVersionFile("package.json", "packageJson"),
  {
    formatTarget: (targetVersion: string) => targetVersion,
    path: "src-tauri/Cargo.toml",
    readVersion: (source: string) => readCargoTomlOwner(source).version,
    sourceKey: "cargoToml" as const,
    update: (source: string, targetVersion: string) => {
      const owner = readCargoTomlOwner(source);
      const updatedElement = owner.element.replace(CARGO_TOML_VERSION_PATTERN, `version = "${targetVersion}"`);
      return `${source.slice(0, owner.start)}${updatedElement}${source.slice(owner.start + owner.element.length)}`;
    },
  },
  {
    formatTarget: (targetVersion: string) => targetVersion,
    path: "src-tauri/Cargo.lock",
    readVersion: (source: string) => readCargoLockOwner(source).version,
    sourceKey: "cargoLock" as const,
    update: (source: string, targetVersion: string) => {
      const owner = readCargoLockOwner(source);
      return `${source.slice(0, owner.start)}${targetVersion}${source.slice(owner.end)}`;
    },
  },
  jsonVersionFile("src-tauri/tauri.conf.json", "tauriConfig"),
  {
    formatTarget: (targetVersion: string) => `${targetVersion}.0`,
    path: "msix/Package.appxmanifest",
    readVersion: (source: string) => readMsixOwner(source).version,
    sourceKey: "msixManifest" as const,
    update: (source: string, targetVersion: string) => {
      const version = readMsixOwner(source);
      return `${source.slice(0, version.start)}${targetVersion}.0${source.slice(version.end)}`;
    },
  },
];

export const prepareVersionChanges = (targetVersion: string, sources: VersionSources): VersionChange[] => {
  validateStableVersion(targetVersion);
  const changes = versionFiles.map((versionFile) => {
    const original = sources[versionFile.sourceKey];
    const currentVersion = versionFile.readVersion(original);
    const updated = versionFile.update(original, targetVersion);
    const updatedVersion = versionFile.readVersion(updated);
    const expectedVersion = versionFile.formatTarget(targetVersion);
    if (updatedVersion !== expectedVersion) {
      throw new Error(
        `version update did not reach ${expectedVersion} in ${versionFile.path}; found ${updatedVersion}`,
      );
    }
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
