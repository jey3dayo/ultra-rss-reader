import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  bundle?: {
    externalBin?: string[];
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
const LINUX_RELEASE_TAURI_CONFIG_PATH = "src-tauri/tauri.linux.release.conf.json";
const DEFAULT_CAPABILITY_PATH = "src-tauri/capabilities/default.json";
const TAURI_LIB_PATH = "src-tauri/src/lib.rs";
const CARGO_TOML_PATH = "src-tauri/Cargo.toml";
const DEV_MOCKS_PATH = "src/dev/mocks.ts";
const VITE_CONFIG_PATH = "vite.config.ts";
const DEV_CREDENTIAL_ENV_PATTERN = /\b(?:DEV_CREDENTIALS|ULTRA_RSS_DEV_CREDENTIALS)\s*:/;
const DEV_ONLY_IMPORT_PATTERN = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;
const STATIC_DEV_MOCKS_IMPORT_PATTERN = /^\s*import\s+(?!type\b)[^;\n]+from\s*["']@\/dev\/mocks["']/m;
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

export const checkReleaseBuildSources = (root = process.cwd()): string[] => {
  const readText = (filePath: string): string => readFileSync(path.join(root, filePath), "utf8");
  const readJson = <T>(filePath: string): T => JSON.parse(readText(filePath)) as T;
  const errors: string[] = [];

  const releaseWorkflow = readText(RELEASE_WORKFLOW_PATH);
  const baseTauriConfig = readJson<TauriConfig>(BASE_TAURI_CONFIG_PATH);
  const tauriReleaseConfig = readJson<TauriConfig>(RELEASE_TAURI_CONFIG_PATH);
  const tauriDevConfig = readJson<TauriConfig>(DEV_TAURI_CONFIG_PATH);
  const defaultCapability = readJson<TauriCapabilityFile>(DEFAULT_CAPABILITY_PATH);
  const tauriLib = readText(TAURI_LIB_PATH);
  const devMocks = readText(DEV_MOCKS_PATH);
  const viteConfig = readText(VITE_CONFIG_PATH);
  const cargoToml = readText(CARGO_TOML_PATH);
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

  // Tauri's `get_binaries` already adds every Cargo `[[bin]]` to the bundle, so an
  // `externalBin` entry that duplicates a Cargo bin name reaches WiX twice and fails
  // `light.exe` on Windows (macOS silently overwrites the duplicate instead).
  const cargoBinNames = [
    ...cargoToml.matchAll(/\[\[bin\]\]\s*\n(?:[^\n[][^\n]*\n?)*?name\s*=\s*(["'])([^"']+)\1/g),
  ].map((match) => match[2]);

  const tauriConfigsToCheck: Array<{ path: string; config: TauriConfig }> = [
    { path: BASE_TAURI_CONFIG_PATH, config: baseTauriConfig },
    { path: DEV_TAURI_CONFIG_PATH, config: tauriDevConfig },
    { path: RELEASE_TAURI_CONFIG_PATH, config: tauriReleaseConfig },
  ];

  if (existsSync(path.join(root, LINUX_RELEASE_TAURI_CONFIG_PATH))) {
    tauriConfigsToCheck.push({
      path: LINUX_RELEASE_TAURI_CONFIG_PATH,
      config: readJson<TauriConfig>(LINUX_RELEASE_TAURI_CONFIG_PATH),
    });
  }

  for (const { path: configPath, config } of tauriConfigsToCheck) {
    for (const externalBin of config.bundle?.externalBin ?? []) {
      const basename = externalBin.split("/").pop() ?? externalBin;
      if (cargoBinNames.includes(basename)) {
        errors.push(
          `${configPath} bundle.externalBin must not list "${externalBin}": Tauri already bundles the Cargo [[bin]] "${basename}", duplicating it breaks WiX`,
        );
      }
    }
  }

  const cargoPackageName = cargoToml.match(/\[package\][^[]*?name\s*=\s*(["'])([^"']+)\1/)?.[2];
  const cargoDefaultRun = cargoToml.match(/\[package\][^[]*?default-run\s*=\s*(["'])([^"']+)\1/)?.[2];

  if (cargoBinNames.length > 1 && cargoDefaultRun !== cargoPackageName) {
    errors.push(
      `Cargo.toml must declare default-run = "${cargoPackageName}" when more than one [[bin]] exists (tauri dev runs cargo run without --bin)`,
    );
  }

  const releaseCsp = baseTauriConfig.app?.security?.csp ?? "";
  const releaseCspDirectives = parseCspDirectives(releaseCsp);

  if (!releaseCsp) {
    errors.push("release Tauri config must define app.security.csp");
  }

  for (const [directive, requiredSources] of Object.entries(REQUIRED_RELEASE_CSP_DIRECTIVES)) {
    const sources = releaseCspDirectives.get(directive) ?? [];
    const sourceSet = new Set(sources);
    for (const requiredSource of requiredSources) {
      if (!sourceSet.has(requiredSource)) {
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

  const bridgePermissions = capabilities.flatMap((capability) =>
    (capability.permissions ?? []).flatMap((permission) => {
      const identifier = permissionIdentifier(permission);
      return identifier.startsWith("mcp-bridge:") ? [identifier] : [];
    }),
  );
  if (bridgePermissions.length > 0) {
    errors.push("release capability must not include debug-only MCP bridge permissions");
  }

  if (
    !/#\[cfg\(all\(debug_assertions, feature = "mcp-bridge"\)\)\]\s*let builder = builder\.plugin\(\s*tauri_plugin_mcp_bridge::Builder::new\(\)/.test(
      tauriLib,
    )
  ) {
    errors.push(
      'release build must keep the MCP bridge plugin behind cfg(all(debug_assertions, feature = "mcp-bridge"))',
    );
  }

  for (const requiredPlugin of REQUIRED_RELEASE_PLUGINS) {
    if (!tauriLib.includes(requiredPlugin)) {
      errors.push(`release runtime must initialize ${requiredPlugin}`);
    }
  }

  if (!/tauri-plugin-mcp-bridge\s*=\s*\{[^}]*optional\s*=\s*true/.test(cargoToml)) {
    errors.push("tauri-plugin-mcp-bridge dependency must be declared with optional = true");
  }

  const mcpBridgeFeatureMatch = cargoToml.match(/mcp-bridge\s*=\s*\[([^\]]*)\]/);
  if (!mcpBridgeFeatureMatch?.[1].includes("dep:tauri-plugin-mcp-bridge")) {
    errors.push('Cargo.toml must define a "mcp-bridge" feature that enables dep:tauri-plugin-mcp-bridge');
  }

  const defaultFeatureMatch = cargoToml.match(/\[features\][^[]*?default\s*=\s*\[([^\]]*)\]/);
  if (defaultFeatureMatch?.[1].includes("mcp-bridge")) {
    errors.push('Cargo.toml default features must not enable "mcp-bridge"');
  }

  if (
    !devMocks.includes("if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;")
  ) {
    errors.push("release build must keep dev browser mocks disabled inside Tauri");
  }

  for (const entry of readdirSync(path.join(root, "src"), { recursive: true })) {
    if (typeof entry !== "string" || !/\.(?:ts|tsx)$/.test(entry)) continue;
    const sourcePath = path.posix.join("src", entry.split(path.sep).join(path.posix.sep));
    if (sourcePath.startsWith("src/dev/") || sourcePath.startsWith("src/__tests__/")) continue;
    const source = readText(sourcePath);
    if (DEV_ONLY_IMPORT_PATTERN.test(source)) {
      errors.push(`release source must not import dev-only mock data or scenario modules: ${sourcePath}`);
    }
    if (STATIC_DEV_MOCKS_IMPORT_PATTERN.test(source)) {
      errors.push(`release source must not statically import dev browser mocks: ${sourcePath}`);
    }
  }
  return errors;
};

type DependencyTreeRunner = (command: string, args: string[], options: ExecFileSyncOptionsWithStringEncoding) => string;

export const checkReleaseDependencyGraph = (
  root = process.cwd(),
  run: DependencyTreeRunner = execFileSync,
): string[] => {
  const timeout = 120_000;
  try {
    const tree = run("cargo", ["tree", "--manifest-path", "src-tauri/Cargo.toml", "-e", "normal", "--locked"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
      killSignal: "SIGKILL",
    });
    if (!tree.trim()) return ["unable to verify the release dependency graph: cargo tree returned empty output"];
    return tree.includes("tauri-plugin-mcp-bridge")
      ? ["release dependency graph (cargo tree without --features mcp-bridge) must not include tauri-plugin-mcp-bridge"]
      : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const details = stderr && !message.includes(stderr) ? `${message}\n${stderr}` : message;
    return [`unable to verify the release dependency graph with cargo tree (timeout ${timeout}ms): ${details}`];
  }
};

const isMainModule =
  typeof process.argv[1] === "string" && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (isMainModule) {
  try {
    console.time("Release source validation");
    const errors = checkReleaseBuildSources();
    console.timeEnd("Release source validation");
    console.log("Validating release dependency graph: cargo tree --locked (timeout 120000ms)");
    console.time("Release dependency graph validation");
    errors.push(...checkReleaseDependencyGraph());
    console.timeEnd("Release dependency graph validation");
    if (errors.length > 0) {
      for (const error of errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log("Release build contamination contract passed");
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
