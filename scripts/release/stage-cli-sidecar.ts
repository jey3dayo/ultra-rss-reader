import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC_TAURI_DIR = "src-tauri";
const BINARIES_DIR = path.join(SRC_TAURI_DIR, "binaries");
const CLI_BIN_NAME = "urr";
const usage = "Usage: node scripts/release/stage-cli-sidecar.ts <cargo-target-triple>";

export const isWindowsTarget = (target: string): boolean => target.includes("windows");

// Plain cargo build (no --features) keeps the mcp-bridge dev-only plugin out of the
// sidecar the same way scripts/check-release-build-contamination.ts enforces it for the app binary.
export const buildUrrCargoArgs = (target: string): string[] => [
  "build",
  "--release",
  "--locked",
  "--bin",
  CLI_BIN_NAME,
  "--target",
  target,
];

// Tauri's externalBin resolution always looks for `<name>-<target-triple>[.exe]`
// regardless of whether --target equals the host default, so this suffix is required
// even for the platform's own default triple.
export const urrSidecarDestinationPath = (target: string): string =>
  path.join(BINARIES_DIR, `${CLI_BIN_NAME}-${target}${isWindowsTarget(target) ? ".exe" : ""}`);

export const urrBuildOutputPath = (target: string): string =>
  path.join(SRC_TAURI_DIR, "target", target, "release", `${CLI_BIN_NAME}${isWindowsTarget(target) ? ".exe" : ""}`);

const fail = (message: string): never => {
  console.error(`::error::${message}`);
  process.exit(1);
};

function main(): void {
  const target = process.argv[2];
  if (!target) {
    fail(usage);
  }

  execFileSync("cargo", buildUrrCargoArgs(target), { cwd: SRC_TAURI_DIR, stdio: "inherit" });

  const source = urrBuildOutputPath(target);
  if (!existsSync(source)) {
    fail(`expected cargo build output missing: ${source}`);
  }

  mkdirSync(BINARIES_DIR, { recursive: true });
  const destination = urrSidecarDestinationPath(target);
  copyFileSync(source, destination);
  console.log(`staged CLI sidecar ${destination}`);
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}
