export const checkJobs = [
  "toolchain",
  "format",
  "lint",
  "rust-clippy",
  "test-node",
  "test-rust",
  "test-jsdom",
  "build",
  "storybook-a11y",
  "native-smoke",
  "audit",
] as const;

export type Plan = {
  full: boolean;
  frontend: boolean;
  native: boolean;
  credentials: boolean;
  windows: boolean;
  storybook: boolean;
};

export function fullPlan(): Plan {
  return { full: true, frontend: true, native: true, credentials: true, windows: true, storybook: true };
}

const credentialTokens = new Set([
  "auth",
  "authentication",
  "authorization",
  "authorize",
  "oauth",
  "credential",
  "credentials",
  "keyring",
  "keychain",
  "account",
  "accounts",
  "secret",
  "secrets",
  "security",
]);

function credentialPath(path: string): boolean {
  if (path.startsWith("src/locales/")) return false;
  return path
    .split(/[/_.-]|(?<=[a-z0-9])(?=[A-Z])/)
    .map((token) => token.toLowerCase())
    .some((token) => credentialTokens.has(token) || (/^sessions?$/.test(token) && path.startsWith("src-tauri/")));
}

function nativePath(path: string): boolean {
  return path.startsWith("src-tauri/") || path.startsWith("src/api/");
}

function sharedOrPlatformPath(path: string): boolean {
  if (path.startsWith("src/locales/")) return false;
  return (
    ["src/lib/", "src/constants/", "src/hooks/", "src/stores/", "src/schemas/", "src/config/", "src/types/"].some(
      (prefix) => path.startsWith(prefix),
    ) ||
    (/(?:platform|updater|native|tauri|filesystem|process)/i.test(path) &&
      !path.startsWith("src-tauri/") &&
      !path.startsWith("src/api/"))
  );
}

type PathKind = {
  storybookFile: boolean;
  frontendFile: boolean;
  trackingFile: boolean;
  rustFile: boolean;
  nativeAsset: boolean;
};

const frontendPrefixes = [
  "src/components/",
  "src/styles/",
  "src/design-system/",
  "src/locales/",
  "src/__tests__/",
  "src/api/",
  "tests/",
];
const nativeAssetPrefixes = ["src-tauri/icons/", "src-tauri/resources/", "src-tauri/capabilities/"];

function unsafePath(path: string): boolean {
  return !path || path.startsWith("/") || path.split("/").includes("..");
}

function classifyPath(path: string): PathKind {
  return {
    storybookFile:
      path.startsWith(".storybook/") || path.startsWith("e2e/storybook/") || path.startsWith("playwright.storybook"),
    frontendFile:
      (frontendPrefixes.some((prefix) => path.startsWith(prefix)) && /\.(?:[cm]?js|jsx|ts|tsx|css)$/.test(path)) ||
      (path.startsWith("src/locales/") && path.endsWith(".json")),
    trackingFile: ["CHANGELOG.md", "todo.txt", "done.txt"].includes(path),
    rustFile: (path.startsWith("src-tauri/src/") || path.startsWith("src-tauri/tests/")) && path.endsWith(".rs"),
    nativeAsset:
      nativeAssetPrefixes.some((prefix) => path.startsWith(prefix)) ||
      path === "src-tauri/tauri.conf.json" ||
      path === "src-tauri/build.rs",
  };
}

function requiresFullPlan(path: string, kind: PathKind): boolean {
  return (
    !(kind.frontendFile || kind.storybookFile || kind.trackingFile || kind.rustFile || kind.nativeAsset) ||
    /(?:^|\/)(?:scripts|release|cli|fs|filesystem|process|bin)(?:\/|[.-])/.test(path) ||
    path.includes("windows-dispatch")
  );
}

function applyPathToPlan(plan: Plan, path: string, kind: PathKind): void {
  if (kind.storybookFile || (kind.frontendFile && !path.startsWith("src/api/"))) plan.storybook = true;
  if (kind.frontendFile || kind.storybookFile || kind.trackingFile || kind.nativeAsset) plan.frontend = true;
  if (nativePath(path) || credentialPath(path)) {
    plan.frontend = true;
    plan.native = true;
    plan.windows = true;
  }
  if (credentialPath(path)) plan.credentials = true;
}

export function planChanges(event: string, paths: readonly string[]): Plan {
  if (event !== "pull_request" || paths.length === 0) return fullPlan();
  const plan: Plan = {
    full: false,
    frontend: false,
    native: false,
    credentials: false,
    windows: false,
    storybook: false,
  };
  for (const path of paths) {
    if (unsafePath(path) || sharedOrPlatformPath(path)) return fullPlan();
    const kind = classifyPath(path);
    if (requiresFullPlan(path, kind)) return fullPlan();
    applyPathToPlan(plan, path, kind);
  }
  return plan;
}

export function requiredJobs(plan: Plan): Record<string, boolean> {
  return {
    toolchain: true,
    format: true,
    lint: plan.frontend,
    "rust-clippy": plan.native,
    "test-node": plan.frontend,
    "test-rust": plan.native,
    "test-jsdom": plan.frontend,
    build: plan.frontend,
    "storybook-a11y": plan.storybook,
    "native-smoke": plan.native,
    audit: plan.full,
  };
}

export type ChangedPaths = { paths: string[]; unclassifiable: boolean };

export function parseChangedPaths(diff: string): ChangedPaths {
  if (!diff.endsWith("\0") && diff !== "") throw new Error("Incomplete NUL-delimited git diff");
  const tokens = diff.split("\0");
  tokens.pop();
  const paths: string[] = [];
  let unclassifiable = false;
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (!status || !/^(?:[ADMTUXB]|[RC]\d{1,3})$/.test(status)) throw new Error("Unknown git diff status");
    if (/^[UXB]$/.test(status)) unclassifiable = true;
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let pathIndex = 0; pathIndex < count; pathIndex++) {
      const path = tokens[index++];
      if (!path) throw new Error("Missing git diff path");
      paths.push(path);
    }
  }
  return { paths, unclassifiable };
}

export function detectPlan(event: string, readDiff: () => string): Plan {
  if (event !== "pull_request") return fullPlan();
  // Detection errors fail the planner; they must never turn an incomplete diff into a smaller plan.
  const { paths, unclassifiable } = parseChangedPaths(readDiff());
  return unclassifiable ? fullPlan() : planChanges(event, paths);
}
