import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type TauriConfig = {
  identifier?: string;
  productName?: string;
  app?: {
    security?: {
      csp?: string;
    };
  };
  build?: {
    devUrl?: string;
  };
};

type TauriCapability = {
  identifier: string;
  webviews?: string[];
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
const BASE_TAURI_CONFIG_PATH = "src-tauri/tauri.conf.json";
const RELEASE_TAURI_CONFIG_PATH = "src-tauri/tauri.release.conf.json";
const DEV_TAURI_CONFIG_PATH = "src-tauri/tauri.dev.conf.json";
const DEFAULT_CAPABILITY_PATH = "src-tauri/capabilities/default.json";
const TAURI_LIB_PATH = "src-tauri/src/lib.rs";
const DEV_MOCKS_PATH = "src/dev/mocks.ts";
const VITE_CONFIG_PATH = "vite.config.ts";
const DEV_CREDENTIAL_ENV_PATTERN = /\b(?:DEV_CREDENTIALS|ULTRA_RSS_DEV_CREDENTIALS)\s*:/;
const DEV_ONLY_IMPORT_PATTERN = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;
const REQUIRED_RELEASE_CSP_DIRECTIVES = {
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["ipc:", "http://ipc.localhost"],
  "font-src": ["'self'"],
} as const;
const RELEASE_CSP_FORBIDDEN_SOURCES = [
  "*",
  "'unsafe-eval'",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "ws://localhost:1421",
  "ws://127.0.0.1:1421",
] as const;
const EXPECTED_CAPABILITY_IDENTIFIERS = ["main", "browser-webview"] as const;
const EXPECTED_BROWSER_WEBVIEW_PERMISSIONS = ["core:event:default"] as const;
const REQUIRED_MAIN_WEBVIEW_PERMISSIONS = [
  "opener:allow-open-url",
  "clipboard-manager:allow-write-text",
  "updater-commands",
] as const;
const REQUIRED_RELEASE_PLUGINS = [
  "tauri_plugin_clipboard_manager::init()",
  "tauri_plugin_opener::init()",
  "tauri_plugin_updater::Builder::new().build()",
] as const;

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

const findCapability = (capabilities: readonly TauriCapability[], identifier: string): TauriCapability | undefined =>
  capabilities.find((capability) => capability.identifier === identifier);

const parseCspDirectives = (csp: string): Map<string, string[]> => {
  const directives = new Map<string, string[]>();

  for (const directive of csp.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) {
      directives.set(name, sources);
    }
  }

  return directives;
};

const errors: string[] = [];
const releaseWorkflow = readText(RELEASE_WORKFLOW_PATH);
const baseTauriConfig = readJson<TauriConfig>(BASE_TAURI_CONFIG_PATH);
const tauriReleaseConfig = readJson<TauriConfig>(RELEASE_TAURI_CONFIG_PATH);
const tauriDevConfig = readJson<TauriConfig>(DEV_TAURI_CONFIG_PATH);
const defaultCapability = readJson<TauriCapabilityFile>(DEFAULT_CAPABILITY_PATH);
const tauriLib = readText(TAURI_LIB_PATH);
const devMocks = readText(DEV_MOCKS_PATH);
const viteConfig = readText(VITE_CONFIG_PATH);
const capabilities = normalizeCapabilities(defaultCapability);

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

const releaseCsp = baseTauriConfig.app?.security?.csp ?? "";
const releaseCspDirectives = parseCspDirectives(releaseCsp);

if (!releaseCsp) {
  errors.push("release Tauri config must define app.security.csp");
}

for (const [directive, requiredSources] of Object.entries(REQUIRED_RELEASE_CSP_DIRECTIVES)) {
  const sources = releaseCspDirectives.get(directive) ?? [];
  for (const requiredSource of requiredSources) {
    if (!sources.includes(requiredSource)) {
      errors.push(`release CSP ${directive} must include ${requiredSource}`);
    }
  }
}

for (const [directive, sources] of releaseCspDirectives) {
  for (const forbiddenSource of RELEASE_CSP_FORBIDDEN_SOURCES) {
    if (sources.includes(forbiddenSource)) {
      errors.push(`release CSP ${directive} must not include ${forbiddenSource}`);
    }
  }
}

if (tauriDevConfig.app?.security?.csp) {
  errors.push("dev Tauri config must inherit the release CSP instead of redefining app.security.csp");
}

if (!viteConfig.includes("port: 1420") || !viteConfig.includes("port: 1421")) {
  errors.push("Vite dev HMR ports must stay explicit for CSP drift review");
}

const capabilityIdentifiers = capabilities.map((capability) => capability.identifier).toSorted();
if (capabilityIdentifiers.join("\n") !== [...EXPECTED_CAPABILITY_IDENTIFIERS].toSorted().join("\n")) {
  errors.push("release capability identifiers must stay limited to main and browser-webview");
}

const mainCapability = findCapability(capabilities, "main");
if (!mainCapability) {
  errors.push("release capability must include the main webview capability");
} else {
  const mainPermissionIds = mainCapability.permissions?.map(permissionIdentifier) ?? [];
  for (const requiredPermission of REQUIRED_MAIN_WEBVIEW_PERMISSIONS) {
    if (!mainPermissionIds.includes(requiredPermission)) {
      errors.push(`release main webview capability must include ${requiredPermission}`);
    }
  }
}

const browserWebviewCapability = findCapability(capabilities, "browser-webview");
if (!browserWebviewCapability) {
  errors.push("release capability must include the browser-webview capability");
} else {
  const browserWebviewPermissionIds = browserWebviewCapability.permissions?.map(permissionIdentifier) ?? [];
  if (browserWebviewCapability.webviews?.join("\n") !== "browser-webview") {
    errors.push("browser-webview capability must only target the embedded browser webview");
  }
  if (browserWebviewPermissionIds.join("\n") !== EXPECTED_BROWSER_WEBVIEW_PERMISSIONS.join("\n")) {
    errors.push("browser-webview capability must remain limited to core:event:default");
  }
}

const bridgePermissions = capabilities.flatMap(
  (capability) =>
    capability.permissions?.map(permissionIdentifier).filter((permission) => permission.startsWith("mcp-bridge:")) ??
    [],
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

for (const requiredPlugin of REQUIRED_RELEASE_PLUGINS) {
  if (!tauriLib.includes(requiredPlugin)) {
    errors.push(`release runtime must initialize ${requiredPlugin}`);
  }
}

if (
  !devMocks.includes("if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;")
) {
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
