import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type TauriConfig = {
  identifier?: string;
  productName?: string;
  build?: {
    devUrl?: string;
  };
};

type TauriCapability = {
  identifier: string;
  permissions?: CapabilityPermission[];
};

type CapabilityPermission =
  | string
  | {
      identifier: string;
    };

type TauriCapabilityFile =
  | TauriCapability
  | TauriCapability[]
  | {
      capabilities: TauriCapability[];
    };

const RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml";
const RELEASE_TAURI_CONFIG_PATH = "src-tauri/tauri.release.conf.json";
const DEV_TAURI_CONFIG_PATH = "src-tauri/tauri.dev.conf.json";
const DEFAULT_CAPABILITY_PATH = "src-tauri/capabilities/default.json";
const TAURI_LIB_PATH = "src-tauri/src/lib.rs";
const DEV_MOCKS_PATH = "src/dev/mocks.ts";
const DEV_CREDENTIAL_ENV_PATTERN = /\b(?:DEV_CREDENTIALS|ULTRA_RSS_DEV_CREDENTIALS)\s*:/;
const DEV_ONLY_IMPORT_PATTERN = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;

const readText = (filePath: string): string => readFileSync(filePath, "utf8");

const readJson = <T>(filePath: string): T => JSON.parse(readText(filePath)) as T;

const normalizePath = (filePath: string): string => filePath.split(path.sep).join(path.posix.sep);

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.(?:ts|tsx)$/.test(entry))
    .map((entry) => normalizePath(path.join(dir, entry)));

const normalizeCapabilities = (source: TauriCapabilityFile): TauriCapability[] => {
  if (Array.isArray(source)) {
    return source;
  }
  if ("capabilities" in source) {
    return source.capabilities;
  }
  return [source];
};

const permissionIdentifier = (permission: CapabilityPermission): string =>
  typeof permission === "string" ? permission : permission.identifier;

const errors: string[] = [];
const releaseWorkflow = readText(RELEASE_WORKFLOW_PATH);
const tauriReleaseConfig = readJson<TauriConfig>(RELEASE_TAURI_CONFIG_PATH);
const tauriDevConfig = readJson<TauriConfig>(DEV_TAURI_CONFIG_PATH);
const defaultCapability = readJson<TauriCapabilityFile>(DEFAULT_CAPABILITY_PATH);
const tauriLib = readText(TAURI_LIB_PATH);
const devMocks = readText(DEV_MOCKS_PATH);

if (releaseWorkflow.includes(`--config ${DEV_TAURI_CONFIG_PATH}`)) {
  errors.push("release build must not use src-tauri/tauri.dev.conf.json");
}

if (!releaseWorkflow.includes(`--config ${RELEASE_TAURI_CONFIG_PATH}`)) {
  errors.push("release build must pass src-tauri/tauri.release.conf.json to tauri-action");
}

if (DEV_CREDENTIAL_ENV_PATTERN.test(releaseWorkflow)) {
  errors.push("release build must not set dev-only credential environment variables");
}

if (tauriReleaseConfig.identifier === tauriDevConfig.identifier) {
  errors.push("release build must not use the dev bundle identifier");
}

if (tauriReleaseConfig.productName === tauriDevConfig.productName) {
  errors.push("release build must not use the dev product name");
}

if (tauriReleaseConfig.build?.devUrl) {
  errors.push("release Tauri config must not define build.devUrl");
}

const bridgePermissions = normalizeCapabilities(defaultCapability).flatMap(
  (capability) =>
    capability.permissions
      ?.map(permissionIdentifier)
      .filter((permission) => permission.startsWith("mcp-bridge:")) ?? [],
);
if (bridgePermissions.length > 0) {
  errors.push("release capability must not include debug-only MCP bridge permissions");
}

if (
  !/#\[cfg\(debug_assertions\)\]\s*let builder = builder\.plugin\(\s*tauri_plugin_mcp_bridge::Builder::new\(\)/.test(
    tauriLib,
  )
) {
  errors.push("release build must keep the MCP bridge plugin behind cfg(debug_assertions)");
}

if (!devMocks.includes("if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;")) {
  errors.push("release build must keep dev browser mocks disabled inside Tauri");
}

const releaseSourceDevOnlyImports = listSourceFiles("src").filter((sourcePath) => {
  if (sourcePath.startsWith("src/dev/") || sourcePath.startsWith("src/__tests__/")) {
    return false;
  }
  return DEV_ONLY_IMPORT_PATTERN.test(readText(sourcePath));
});

for (const sourcePath of releaseSourceDevOnlyImports) {
  errors.push(`release source must not import dev-only mock data or scenario modules: ${sourcePath}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Release build contamination contract passed");
}
