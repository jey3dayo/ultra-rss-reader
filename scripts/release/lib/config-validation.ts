import { isRecord } from "../../lib/type-guards.ts";
import {
  findCargoLockPackageVersionOwners,
  findMsixIdentityVersionOwners,
  findTopLevelJsonVersionOwners,
  MSIX_VERSION_COMPONENT_MAX,
  type MsixIdentityVersionOwners,
  type SourceVersionOwner,
  STABLE_VERSION_PATTERN,
} from "./version-owners.ts";

export type ReleaseConfigSources = {
  cargoLock: string;
  cargoToml: string;
  defaultCapability: string;
  devTauriConfig: string;
  msixManifest: string;
  packageJson: string;
  releaseTauriConfig: string;
  releaseWorkflow: string;
  tauriConfig: string;
};

type PackageJson = {
  version?: string;
};

type TauriConfig = {
  identifier?: string;
  productName?: string;
  version?: string;
  bundle?: {
    createUpdaterArtifacts?: boolean;
  };
  plugins?: {
    updater?: {
      endpoints?: string[];
      pubkey?: string;
    };
  };
};

type TauriCapability = {
  identifier: string;
  webviews?: string[];
  permissions?: Array<string | { identifier: string }>;
};

const RELEASE_UPDATER_ENDPOINT = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const CARGO_PACKAGE_SECTION_PATTERN = /^\[package\]\s*$/gm;
const CARGO_TOML_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"\s*$/gm;

const optionalString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const parsePackageJson = (source: string): PackageJson => {
  const parsed: unknown = JSON.parse(source);
  return isRecord(parsed) ? { version: optionalString(parsed.version) } : {};
};

const parseTauriConfig = (source: string): TauriConfig => {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) return {};

  const bundleValue = isRecord(parsed.bundle) ? parsed.bundle : undefined;
  const updaterValue =
    isRecord(parsed.plugins) && isRecord(parsed.plugins.updater) ? parsed.plugins.updater : undefined;
  const endpointsValue = updaterValue?.endpoints;
  const endpoints =
    Array.isArray(endpointsValue) &&
    endpointsValue.every((endpoint): endpoint is string => typeof endpoint === "string")
      ? endpointsValue
      : undefined;

  return {
    bundle: bundleValue
      ? {
          createUpdaterArtifacts:
            typeof bundleValue.createUpdaterArtifacts === "boolean" ? bundleValue.createUpdaterArtifacts : undefined,
        }
      : undefined,
    identifier: optionalString(parsed.identifier),
    plugins: updaterValue
      ? {
          updater: {
            endpoints,
            pubkey: optionalString(updaterValue.pubkey),
          },
        }
      : undefined,
    productName: optionalString(parsed.productName),
    version: optionalString(parsed.version),
  };
};

const parseStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    throw new Error("Tauri capability string list is malformed");
  }
  return value;
};

const parsePermission = (value: unknown): string | { identifier: string } => {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.identifier === "string") return { identifier: value.identifier };
  throw new Error("Tauri capability permission is malformed");
};

const parseCapability = (value: unknown): TauriCapability => {
  if (!isRecord(value) || typeof value.identifier !== "string") {
    throw new Error("Tauri capability is malformed");
  }
  const permissionsValue = value.permissions;
  if (permissionsValue !== undefined && !Array.isArray(permissionsValue)) {
    throw new Error("Tauri capability permissions are malformed");
  }

  return {
    identifier: value.identifier,
    permissions: Array.isArray(permissionsValue) ? permissionsValue.map(parsePermission) : undefined,
    webviews: parseStringArray(value.webviews),
  };
};

const parseCapabilityFile = (source: string): TauriCapability[] => {
  const parsed: unknown = JSON.parse(source);
  if (Array.isArray(parsed)) return parsed.map(parseCapability);
  if (!isRecord(parsed)) throw new Error("Tauri capability file is malformed");
  if ("capabilities" in parsed) {
    if (!Array.isArray(parsed.capabilities)) throw new Error("Tauri capability list is malformed");
    return parsed.capabilities.map(parseCapability);
  }
  return [parseCapability(parsed)];
};

const readCargoTomlVersionOwners = (source: string): { sectionCount: number; versions: string[] } => {
  const sections = [...source.matchAll(CARGO_PACKAGE_SECTION_PATTERN)];
  const versions = sections.flatMap((section) => {
    const sectionStart = (section.index ?? 0) + section[0].length;
    const nextSectionOffset = source.slice(sectionStart).search(/^\[/m);
    const sectionEnd = nextSectionOffset === -1 ? source.length : sectionStart + nextSectionOffset;
    return [...source.slice(sectionStart, sectionEnd).matchAll(CARGO_TOML_VERSION_PATTERN)].map(
      (match) => match[1] ?? "",
    );
  });
  return { sectionCount: sections.length, versions };
};

const permissionIdentifier = (permission: string | { identifier: string }): string =>
  typeof permission === "string" ? permission : permission.identifier;

const collectVersionOwnerErrors = (
  packageVersionMatches: SourceVersionOwner[],
  tauriVersionMatches: SourceVersionOwner[],
  cargoVersionOwners: { sectionCount: number; versions: string[] },
): string[] => {
  const errors: string[] = [];
  if (packageVersionMatches.length !== 1) {
    errors.push(`package.json must contain exactly one version owner, found ${packageVersionMatches.length}`);
  }
  if (tauriVersionMatches.length !== 1) {
    errors.push(
      `src-tauri/tauri.conf.json must contain exactly one version owner, found ${tauriVersionMatches.length}`,
    );
  }
  if (cargoVersionOwners.sectionCount !== 1 || cargoVersionOwners.versions.length !== 1) {
    errors.push(
      `src-tauri/Cargo.toml must contain exactly one [package] section and version owner, found ${cargoVersionOwners.sectionCount} sections and ${cargoVersionOwners.versions.length} versions`,
    );
  }
  return errors;
};

const collectPackageVersionErrors = (
  packageJson: PackageJson,
  releaseTag: string | undefined,
  tauriConfig: TauriConfig,
  cargoVersion: string | undefined,
  cargoLockPackageMatches: Array<string | undefined>,
): string[] => {
  const errors: string[] = [];
  const versionMatch = packageJson.version?.match(STABLE_VERSION_PATTERN);
  if (!versionMatch) {
    errors.push(`package.json version ${packageJson.version ?? "(missing)"} must be a stable X.Y.Z version`);
  } else if (versionMatch.slice(1).some((component) => Number(component) > MSIX_VERSION_COMPONENT_MAX)) {
    errors.push(`package.json version components must not exceed ${MSIX_VERSION_COMPONENT_MAX} for MSIX`);
  }
  if (releaseTag !== `v${packageJson.version}`) {
    errors.push(`release tag ${releaseTag} does not match package.json version v${packageJson.version}`);
  }
  if (tauriConfig.version !== packageJson.version) {
    errors.push(
      `src-tauri/tauri.conf.json version ${tauriConfig.version} does not match package.json version ${packageJson.version}`,
    );
  }
  if (cargoVersion !== packageJson.version) {
    errors.push(
      `src-tauri/Cargo.toml version ${cargoVersion ?? "(missing)"} does not match package.json version ${packageJson.version}`,
    );
  }
  if (cargoLockPackageMatches.length !== 1 || !cargoLockPackageMatches[0]) {
    errors.push(
      `src-tauri/Cargo.lock must contain exactly one ultra-rss-reader package entry, found ${cargoLockPackageMatches.length}`,
    );
  } else if (cargoLockPackageMatches[0] !== packageJson.version) {
    errors.push(
      `src-tauri/Cargo.lock ultra-rss-reader version ${cargoLockPackageMatches[0]} does not match package.json version ${packageJson.version}`,
    );
  }
  return errors;
};

const collectMsixErrors = (
  packageJson: PackageJson,
  msixIdentityMatches: MsixIdentityVersionOwners[],
  msixIdentityVersions: SourceVersionOwner[],
  msixManifestVersion: string | undefined,
): string[] => {
  const errors: string[] = [];
  if (msixIdentityMatches.length !== 1) {
    errors.push(
      `msix/Package.appxmanifest must contain exactly one Identity element, found ${msixIdentityMatches.length}`,
    );
  } else if (msixIdentityVersions.length !== 1) {
    errors.push(
      `msix/Package.appxmanifest Identity must contain exactly one Version attribute, found ${msixIdentityVersions.length}`,
    );
  } else if (msixManifestVersion !== `${packageJson.version}.0`) {
    errors.push(
      `msix/Package.appxmanifest Identity version ${msixManifestVersion ?? "(missing)"} does not match package.json version ${packageJson.version}.0`,
    );
  }
  return errors;
};

const collectTauriConfigErrors = (
  tauriConfig: TauriConfig,
  tauriReleaseConfig: TauriConfig,
  tauriDevConfig: TauriConfig,
  updaterEndpoint: string | undefined,
  updaterPubkey: string | undefined,
): string[] => {
  const errors: string[] = [];
  if (tauriReleaseConfig.identifier !== tauriConfig.identifier) {
    errors.push(
      `src-tauri/tauri.release.conf.json identifier ${tauriReleaseConfig.identifier} does not match src-tauri/tauri.conf.json identifier ${tauriConfig.identifier}`,
    );
  }
  if (tauriConfig.bundle?.createUpdaterArtifacts !== false) {
    errors.push("src-tauri/tauri.conf.json must keep updater artifacts disabled for dev builds");
  }
  if (tauriReleaseConfig.bundle?.createUpdaterArtifacts !== true) {
    errors.push("src-tauri/tauri.release.conf.json must enable updater artifacts for release builds");
  }
  if (tauriReleaseConfig.identifier === tauriDevConfig.identifier) {
    errors.push("src-tauri/tauri.release.conf.json must not use the dev Tauri identifier");
  }
  if (tauriReleaseConfig.productName === tauriDevConfig.productName) {
    errors.push("src-tauri/tauri.release.conf.json must not use the dev Tauri product name");
  }
  if (updaterEndpoint !== RELEASE_UPDATER_ENDPOINT) {
    errors.push(
      `src-tauri/tauri.conf.json updater endpoint ${updaterEndpoint ?? "(missing)"} does not match the GitHub release latest.json endpoint`,
    );
  }
  if (!updaterPubkey || UPDATER_PUBKEY_PLACEHOLDER_PATTERN.test(updaterPubkey)) {
    errors.push("src-tauri/tauri.conf.json updater pubkey must be configured and must not be a placeholder");
  }
  return errors;
};

const collectReleaseWorkflowErrors = (releaseWorkflow: string): string[] => {
  const errors: string[] = [];
  if (!releaseWorkflow.includes("--config src-tauri/tauri.release.conf.json")) {
    errors.push("release workflow must pass src-tauri/tauri.release.conf.json to tauri-action");
  }
  if (releaseWorkflow.includes("--config src-tauri/tauri.dev.conf.json")) {
    errors.push("release workflow must not pass src-tauri/tauri.dev.conf.json to tauri-action");
  }
  if (/\bDEV_CREDENTIALS\s*:/.test(releaseWorkflow) || /\bULTRA_RSS_DEV_CREDENTIALS\s*:/.test(releaseWorkflow)) {
    errors.push("release workflow must not set dev credential environment variables");
  }
  return errors;
};

const collectCapabilityErrors = (
  defaultCapability: TauriCapability[],
  mainCapability: TauriCapability | undefined,
  browserWebviewCapability: TauriCapability | undefined,
): string[] => {
  const errors: string[] = [];
  if (!Array.isArray(mainCapability?.permissions)) {
    errors.push("src-tauri/capabilities/default.json must declare main release permissions explicitly");
  } else if (
    defaultCapability
      .flatMap((capability) =>
        (capability.permissions ?? []).flatMap((permission) => [permissionIdentifier(permission)]),
      )
      .some((permission) => permission.startsWith("mcp-bridge:"))
  ) {
    errors.push("release capability must not include debug-only MCP bridge permissions");
  }
  if (!browserWebviewCapability) {
    errors.push("src-tauri/capabilities/default.json must declare a browser-webview capability");
  } else if (
    JSON.stringify(browserWebviewCapability.webviews) !== JSON.stringify(["browser-webview"]) ||
    JSON.stringify(browserWebviewCapability.permissions?.map(permissionIdentifier)) !==
      JSON.stringify(["core:event:default"])
  ) {
    errors.push("browser-webview capability must stay on the minimal core event permission snapshot");
  }
  return errors;
};

export const validateReleaseConfigSources = ({
  releaseTag,
  sources,
}: {
  releaseTag: string | undefined;
  sources: ReleaseConfigSources;
}): string[] => {
  const packageJson = parsePackageJson(sources.packageJson);
  const tauriConfig = parseTauriConfig(sources.tauriConfig);
  const tauriReleaseConfig = parseTauriConfig(sources.releaseTauriConfig);
  const tauriDevConfig = parseTauriConfig(sources.devTauriConfig);
  const defaultCapability = parseCapabilityFile(sources.defaultCapability);
  const packageVersionMatches = findTopLevelJsonVersionOwners(sources.packageJson);
  const tauriVersionMatches = findTopLevelJsonVersionOwners(sources.tauriConfig);
  const cargoVersionOwners = readCargoTomlVersionOwners(sources.cargoToml);
  const cargoVersion =
    cargoVersionOwners.sectionCount === 1 && cargoVersionOwners.versions.length === 1
      ? cargoVersionOwners.versions[0]
      : undefined;
  const cargoLockPackageMatches = findCargoLockPackageVersionOwners(sources.cargoLock).map((owner) =>
    owner.nameCount === 1 && owner.versions.length === 1 ? owner.versions[0]?.version : undefined,
  );
  const msixIdentityMatches = findMsixIdentityVersionOwners(sources.msixManifest);
  const msixIdentityVersions = msixIdentityMatches.length === 1 ? (msixIdentityMatches[0]?.versions ?? []) : [];
  const msixManifestVersion = msixIdentityVersions.length === 1 ? msixIdentityVersions[0]?.version : undefined;
  const updaterEndpoint = tauriConfig.plugins?.updater?.endpoints?.[0];
  const updaterPubkey = tauriConfig.plugins?.updater?.pubkey;
  const mainCapability = defaultCapability.find((capability) => capability.identifier === "main");
  const browserWebviewCapability = defaultCapability.find((capability) => capability.identifier === "browser-webview");

  return [
    ...collectVersionOwnerErrors(packageVersionMatches, tauriVersionMatches, cargoVersionOwners),
    ...collectPackageVersionErrors(packageJson, releaseTag, tauriConfig, cargoVersion, cargoLockPackageMatches),
    ...collectMsixErrors(packageJson, msixIdentityMatches, msixIdentityVersions, msixManifestVersion),
    ...collectTauriConfigErrors(tauriConfig, tauriReleaseConfig, tauriDevConfig, updaterEndpoint, updaterPubkey),
    ...collectReleaseWorkflowErrors(sources.releaseWorkflow),
    ...collectCapabilityErrors(defaultCapability, mainCapability, browserWebviewCapability),
  ];
};
