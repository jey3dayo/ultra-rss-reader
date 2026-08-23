import { readFileSync } from "node:fs";

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

type TauriCapabilityFile = TauriCapability | TauriCapability[] | { capabilities: TauriCapability[] };

const RELEASE_TAURI_CONFIG_PATH = "src-tauri/tauri.release.conf.json";
const DEV_TAURI_CONFIG_PATH = "src-tauri/tauri.dev.conf.json";
const RELEASE_UPDATER_ENDPOINT = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const MSIX_VERSION_COMPONENT_MAX = 65_535;
const MSIX_IDENTITY_PATTERN = /<Identity\b[^>]*\/>/g;
const MSIX_IDENTITY_VERSION_PATTERN = /\bVersion="([^"]+)"/g;
const CARGO_PACKAGE_SECTION_PATTERN = /^\[package\]\s*$/gm;
const CARGO_TOML_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"\s*$/gm;
const CARGO_LOCK_PACKAGE_SECTION_PATTERN = /^\[\[package\]\]\s*$/gm;
const CARGO_LOCK_NAME_PATTERN = /^name\s*=\s*"([^"]+)"\s*$/gm;
const CARGO_LOCK_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"\s*$/gm;

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const readJsonString = (source: string, start: number): { value: string; end: number } => {
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === '"') {
      const parsed = JSON.parse(source.slice(start, index + 1));
      if (typeof parsed !== "string") throw new Error("JSON string token is not a string");
      return { value: parsed, end: index + 1 };
    }
  }
  throw new Error("unterminated JSON string");
};

const readTopLevelJsonVersionOwners = (source: string): string[] => {
  const owners: string[] = [];
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const key = readJsonString(source, index);
      if (depth === 1 && key.value === "version") {
        let valueStart = key.end;
        while (/\s/.test(source[valueStart] ?? "")) valueStart += 1;
        if (source[valueStart] !== ":") {
          index = key.end - 1;
          continue;
        }
        valueStart += 1;
        while (/\s/.test(source[valueStart] ?? "")) valueStart += 1;
        if (source[valueStart] !== '"') throw new Error("JSON version owner must be a string");
        const value = readJsonString(source, valueStart);
        owners.push(value.value);
        index = value.end - 1;
      } else {
        index = key.end - 1;
      }
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
  }

  return owners;
};

const readCargoTomlVersionOwners = (source: string): { sectionCount: number; versions: string[] } => {
  const sections = [...source.matchAll(CARGO_PACKAGE_SECTION_PATTERN)];
  const versions = sections.flatMap((section) => {
    const sectionStart = (section.index ?? 0) + section[0].length;
    const nextSectionOffset = source.slice(sectionStart).search(/^\[/m);
    const sectionEnd = nextSectionOffset === -1 ? source.length : sectionStart + nextSectionOffset;
    return [...source.slice(sectionStart, sectionEnd).matchAll(CARGO_TOML_VERSION_PATTERN)].map((match) => match[1]);
  });
  return { sectionCount: sections.length, versions };
};

const readCargoLockVersionOwners = (source: string): Array<string | undefined> => {
  const sections = [...source.matchAll(CARGO_LOCK_PACKAGE_SECTION_PATTERN)];
  return sections.flatMap((section, index) => {
    const sectionStart = (section.index ?? 0) + section[0].length;
    const sectionEnd = sections[index + 1]?.index ?? source.length;
    const packageSection = source.slice(sectionStart, sectionEnd);
    const names = [...packageSection.matchAll(CARGO_LOCK_NAME_PATTERN)];
    if (!names.some((name) => name[1] === "ultra-rss-reader")) return [];
    const versions = [...packageSection.matchAll(CARGO_LOCK_VERSION_PATTERN)];
    return [names.length === 1 && versions.length === 1 ? versions[0][1] : undefined];
  });
};

const normalizeCapabilities = (source: TauriCapabilityFile): TauriCapability[] => {
  if (Array.isArray(source)) {
    return source;
  }
  if ("capabilities" in source) {
    return source.capabilities;
  }
  return [source];
};

const permissionIdentifier = (permission: string | { identifier: string }): string =>
  typeof permission === "string" ? permission : permission.identifier;

const releaseTag = process.env.RELEASE_TAG;
const packageJson = readJson<PackageJson>("package.json");
const tauriConfig = readJson<TauriConfig>("src-tauri/tauri.conf.json");
const tauriReleaseConfig = readJson<TauriConfig>(RELEASE_TAURI_CONFIG_PATH);
const tauriDevConfig = readJson<TauriConfig>(DEV_TAURI_CONFIG_PATH);
const defaultCapability = readJson<TauriCapabilityFile>("src-tauri/capabilities/default.json");
const packageJsonSource = readFileSync("package.json", "utf8");
const tauriConfigSource = readFileSync("src-tauri/tauri.conf.json", "utf8");
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoLock = readFileSync("src-tauri/Cargo.lock", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const msixManifest = readFileSync("msix/Package.appxmanifest", "utf8");
const packageVersionMatches = readTopLevelJsonVersionOwners(packageJsonSource);
const tauriVersionMatches = readTopLevelJsonVersionOwners(tauriConfigSource);
const cargoVersionOwners = readCargoTomlVersionOwners(cargoToml);
const cargoVersion =
  cargoVersionOwners.sectionCount === 1 && cargoVersionOwners.versions.length === 1
    ? cargoVersionOwners.versions[0]
    : undefined;
const cargoLockPackageMatches = readCargoLockVersionOwners(cargoLock);
const msixIdentityMatches = [...msixManifest.matchAll(MSIX_IDENTITY_PATTERN)];
const msixManifestIdentityBlock = msixIdentityMatches.length === 1 ? msixIdentityMatches[0][0] : undefined;
const msixIdentityVersionMatches = msixManifestIdentityBlock
  ? [...msixManifestIdentityBlock.matchAll(MSIX_IDENTITY_VERSION_PATTERN)]
  : [];
const msixManifestVersion = msixIdentityVersionMatches.length === 1 ? msixIdentityVersionMatches[0][1] : undefined;
const expectedTag = `v${packageJson.version}`;
const updaterEndpoint = tauriConfig.plugins?.updater?.endpoints?.[0];
const updaterPubkey = tauriConfig.plugins?.updater?.pubkey;
const capabilities = normalizeCapabilities(defaultCapability);
const mainCapability = capabilities.find((capability) => capability.identifier === "main");
const browserWebviewCapability = capabilities.find((capability) => capability.identifier === "browser-webview");

const errors: string[] = [];
if (packageVersionMatches.length !== 1) {
  errors.push(`package.json must contain exactly one version owner, found ${packageVersionMatches.length}`);
}
if (tauriVersionMatches.length !== 1) {
  errors.push(`src-tauri/tauri.conf.json must contain exactly one version owner, found ${tauriVersionMatches.length}`);
}
if (cargoVersionOwners.sectionCount !== 1 || cargoVersionOwners.versions.length !== 1) {
  errors.push(
    `src-tauri/Cargo.toml must contain exactly one [package] section and version owner, found ${cargoVersionOwners.sectionCount} sections and ${cargoVersionOwners.versions.length} versions`,
  );
}
const versionMatch = packageJson.version?.match(STABLE_VERSION_PATTERN);
if (!versionMatch) {
  errors.push(`package.json version ${packageJson.version ?? "(missing)"} must be a stable X.Y.Z version`);
} else if (versionMatch.slice(1).some((component) => Number(component) > MSIX_VERSION_COMPONENT_MAX)) {
  errors.push(`package.json version components must not exceed ${MSIX_VERSION_COMPONENT_MAX} for MSIX`);
}
if (releaseTag !== expectedTag) {
  errors.push(`release tag ${releaseTag} does not match package.json version ${expectedTag}`);
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
if (msixIdentityMatches.length !== 1) {
  errors.push(
    `msix/Package.appxmanifest must contain exactly one Identity element, found ${msixIdentityMatches.length}`,
  );
} else if (msixIdentityVersionMatches.length !== 1) {
  errors.push(
    `msix/Package.appxmanifest Identity must contain exactly one Version attribute, found ${msixIdentityVersionMatches.length}`,
  );
} else if (msixManifestVersion !== `${packageJson.version}.0`) {
  errors.push(
    `msix/Package.appxmanifest Identity version ${msixManifestVersion ?? "(missing)"} does not match package.json version ${packageJson.version}.0`,
  );
}
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
if (!releaseWorkflow.includes(`--config ${RELEASE_TAURI_CONFIG_PATH}`)) {
  errors.push("release workflow must pass src-tauri/tauri.release.conf.json to tauri-action");
}
if (releaseWorkflow.includes(`--config ${DEV_TAURI_CONFIG_PATH}`)) {
  errors.push("release workflow must not pass src-tauri/tauri.dev.conf.json to tauri-action");
}
if (/\bDEV_CREDENTIALS\s*:/.test(releaseWorkflow) || /\bULTRA_RSS_DEV_CREDENTIALS\s*:/.test(releaseWorkflow)) {
  errors.push("release workflow must not set dev credential environment variables");
}
if (!Array.isArray(mainCapability?.permissions)) {
  errors.push("src-tauri/capabilities/default.json must declare main release permissions explicitly");
} else if (
  capabilities
    .flatMap((capability) => capability.permissions ?? [])
    .map(permissionIdentifier)
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

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`::error::${error}`);
  }
  process.exit(1);
}
