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

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

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
const cargoToml = readFileSync("src-tauri/Cargo.toml", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];
const expectedTag = `v${packageJson.version}`;
const updaterEndpoint = tauriConfig.plugins?.updater?.endpoints?.[0];
const updaterPubkey = tauriConfig.plugins?.updater?.pubkey;
const capabilities = normalizeCapabilities(defaultCapability);
const mainCapability = capabilities.find((capability) => capability.identifier === "main");
const browserWebviewCapability = capabilities.find((capability) => capability.identifier === "browser-webview");

const errors: string[] = [];
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
