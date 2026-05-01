import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  buildWslWindowsSpawnSpec,
  canUseWindowsInterop,
  convertWslPathToWindows,
  isWslEnvironment,
  pickWindowsEnvOverrides,
  type SpawnSpec,
} from "./lib/windows-dispatch.ts";

export { isWslEnvironment, pickWindowsEnvOverrides } from "./lib/windows-dispatch.ts";

type ReadFileImpl = (targetPath: string, encoding: "utf8") => Promise<string>;
type RmImpl = (targetPath: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;

export function buildLocalTauriSpawnSpec(cliArgs: string[], scriptUrl: string = import.meta.url): SpawnSpec {
  void scriptUrl;

  return {
    command: "pnpm",
    args: ["exec", "tauri", ...cliArgs],
  };
}

const DEV_CONFIG_PATH = path.join("src-tauri", "tauri.dev.conf.json");
const STALE_MACOS_DEV_BUNDLE_PATHS = [
  path.join("src-tauri", "target", "debug", "bundle", "macos", "Ultra RSS Reader Dev.app"),
  path.join("src-tauri", "target", "release", "bundle", "macos", "Ultra RSS Reader Dev.app"),
  path.join("src-tauri", "target", "debug", "bundle", "macos", "Ultra RSS Reader.app"),
  path.join("src-tauri", "target", "release", "bundle", "macos", "Ultra RSS Reader.app"),
];

function normalizePathForComparison(value: string): string {
  return value.replaceAll("\\", "/");
}

export function shouldCleanStaleMacosDevBundle(cliArgs: string[]): boolean {
  return (
    cliArgs[0] === "dev" &&
    cliArgs.some((arg) => normalizePathForComparison(arg) === normalizePathForComparison(DEV_CONFIG_PATH))
  );
}

export async function removeStaleMacosDevBundle(
  options: { cwd?: string; platform?: NodeJS.Platform; readFileImpl?: ReadFileImpl; rmImpl?: RmImpl } = {},
): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const readFileImpl = options.readFileImpl ?? ((targetPath, encoding) => readFile(targetPath, encoding));
  const rmImpl = options.rmImpl ?? ((targetPath, rmOptions) => rm(targetPath, rmOptions));

  if (platform !== "darwin") {
    return false;
  }

  let removedAny = false;

  for (const bundlePath of STALE_MACOS_DEV_BUNDLE_PATHS) {
    const infoPlistPath = path.join(cwd, bundlePath, "Contents", "Info.plist");
    let infoPlist = "";
    try {
      infoPlist = await readFileImpl(infoPlistPath, "utf8");
    } catch {
      continue;
    }

    if (
      !infoPlist.includes("<key>CFBundleIdentifier</key>") ||
      !infoPlist.includes("<string>com.ultra-rss-reader.dev</string>")
    ) {
      continue;
    }

    await rmImpl(path.join(cwd, bundlePath), { recursive: true, force: true });
    removedAny = true;
  }

  return removedAny;
}

export function buildWslTauriSpawnSpec(
  cliArgs: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): SpawnSpec {
  return buildWslWindowsSpawnSpec("pnpm", ["exec", "tauri", ...cliArgs], windowsCwd, envOverrides);
}

async function resolveSpawnSpec(cliArgs: string[]): Promise<SpawnSpec> {
  if (!isWslEnvironment()) {
    return buildLocalTauriSpawnSpec(cliArgs);
  }

  if (!(await canUseWindowsInterop())) {
    return buildLocalTauriSpawnSpec(cliArgs);
  }

  const windowsCwd = await convertWslPathToWindows(process.cwd());
  return buildWslTauriSpawnSpec(cliArgs, windowsCwd, pickWindowsEnvOverrides(process.env));
}

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  if (shouldCleanStaleMacosDevBundle(cliArgs)) {
    await removeStaleMacosDevBundle();
  }
  const spawnSpec = await resolveSpawnSpec(cliArgs);
  const child = spawn(spawnSpec.command, spawnSpec.args, {
    stdio: "inherit",
    env: process.env,
  });

  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error("[tauri-cli-dispatch] failed to start Tauri CLI:", error);
    process.exit(1);
  });
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[tauri-cli-dispatch]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
