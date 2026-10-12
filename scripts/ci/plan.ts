export const checkJobs = [
  "toolchain",
  "format",
  "lint",
  "rust-clippy",
  "test-node",
  "test-rust",
  "test-jsdom",
  "build",
  "native-smoke",
  "audit",
] as const;

export type Plan = { full: boolean; frontend: boolean; native: boolean; credentials: boolean; windows: boolean };

export function fullPlan(): Plan {
  return { full: true, frontend: true, native: true, credentials: true, windows: true };
}

function credentialPath(path: string): boolean {
  if (path.startsWith("src/locales/")) return false;
  return /(?:auth|credential|keyring|keychain|session|account|secret|security)/i.test(path);
}

function nativePath(path: string): boolean {
  return (
    path.startsWith("src-tauri/") ||
    path.startsWith("src/api/") ||
    path.startsWith("src/lib/runtime/") ||
    path.startsWith("src/lib/window/")
  );
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

export function planChanges(event: string, paths: readonly string[]): Plan {
  if (event !== "pull_request" || paths.length === 0) return fullPlan();
  const plan: Plan = { full: false, frontend: false, native: false, credentials: false, windows: false };
  for (const path of paths) {
    if (!path || path.startsWith("/") || path.split("/").includes("..")) return fullPlan();
    if (sharedOrPlatformPath(path)) return fullPlan();
    const frontendFile =
      ([
        "src/components/",
        "src/styles/",
        "src/design-system/",
        "src/locales/",
        "src/__tests__/",
        "src/api/",
        "tests/",
      ].some((prefix) => path.startsWith(prefix)) &&
        /\.(?:[cm]?js|jsx|ts|tsx|css)$/.test(path)) ||
      (path.startsWith("src/locales/") && path.endsWith(".json"));
    const rustFile = (path.startsWith("src-tauri/src/") || path.startsWith("src-tauri/tests/")) && path.endsWith(".rs");
    const nativeAsset =
      ["src-tauri/icons/", "src-tauri/resources/", "src-tauri/capabilities/"].some((prefix) =>
        path.startsWith(prefix),
      ) ||
      path === "src-tauri/tauri.conf.json" ||
      path === "src-tauri/build.rs";
    if (
      !(frontendFile || rustFile || nativeAsset) ||
      /(?:^|\/)(?:scripts|release|cli|fs|filesystem|process|bin)(?:\/|[.-])/.test(path) ||
      path.includes("windows-dispatch")
    )
      return fullPlan();
    if (frontendFile || nativeAsset) plan.frontend = true;
    if (nativePath(path) || credentialPath(path)) {
      plan.frontend = true;
      plan.native = true;
      plan.windows = true;
    }
    if (credentialPath(path)) plan.credentials = true;
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
    "native-smoke": plan.native,
    audit: plan.full,
  };
}

export function parseChangedPaths(diff: string): string[] {
  if (!diff.endsWith("\0") && diff !== "") throw new Error("Incomplete NUL-delimited git diff");
  const tokens = diff.split("\0");
  tokens.pop();
  const paths: string[] = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index++];
    if (!status || !/^(?:[ADM]|[RC]\d{1,3})$/.test(status)) throw new Error("Unknown git diff status");
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let pathIndex = 0; pathIndex < count; pathIndex++) {
      const path = tokens[index++];
      if (!path) throw new Error("Missing git diff path");
      paths.push(path);
    }
  }
  return paths;
}

export function detectPlan(event: string, readDiff: () => string): Plan {
  if (event !== "pull_request") return fullPlan();
  // Detection errors fail the planner; they must never turn an incomplete diff into a smaller plan.
  return planChanges(event, parseChangedPaths(readDiff()));
}
