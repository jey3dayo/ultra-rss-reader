import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  buildWindowsDispatchSpawnFailureMessage,
  buildWslWindowsSpawnSpec,
  canUseWindowsInterop,
  convertWslPathToWindows,
  installSignalForwarding,
  isWslEnvironment,
  pickWindowsEnvOverrides,
  type SpawnSpec,
  shouldSpawnDetachedForSignalForwarding,
} from "./lib/windows-dispatch.ts";

export { isWslEnvironment, pickWindowsEnvOverrides } from "./lib/windows-dispatch.ts";

type ReadFileImpl = (targetPath: string, encoding: "utf8") => Promise<string>;
type RmImpl = (targetPath: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;
type WarnImpl = (message: string) => void;

export function buildPnpmCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export function buildLocalTauriSpawnSpec(
  cliArgs: string[],
  scriptUrl: string = import.meta.url,
  platform: NodeJS.Platform = process.platform,
): SpawnSpec {
  void scriptUrl;

  return {
    command: buildPnpmCommand(platform),
    args: ["exec", "tauri", ...cliArgs],
    shell: platform === "win32",
  };
}

const DEV_CONFIG_PATH = path.join("src-tauri", "tauri.dev.conf.json");
const STALE_MACOS_DEV_BUNDLE_PATHS = [
  path.join("src-tauri", "target", "debug", "bundle", "macos", "Ultra RSS Reader Dev.app"),
  path.join("src-tauri", "target", "release", "bundle", "macos", "Ultra RSS Reader Dev.app"),
  path.join("src-tauri", "target", "debug", "bundle", "macos", "Ultra RSS Reader.app"),
  path.join("src-tauri", "target", "release", "bundle", "macos", "Ultra RSS Reader.app"),
];
const CONFIG_PATH_ARG_FLAGS = new Set(["-c", "--config"]);
const MACOS_BUNDLE_IDENTIFIER_KEY_MARKER = "<key>CFBundleIdentifier</key>";
const MACOS_DEV_BUNDLE_IDENTIFIER_VALUE_MARKER = "<string>com.ultra-rss-reader.dev</string>";

function normalizePathForComparison(value: string): string {
  return value.replaceAll("\\", "/");
}

function collectConfigArgs(cliArgs: string[]): string[] {
  const configPaths: string[] = [];

  for (let index = 0; index < cliArgs.length; index += 1) {
    const arg = cliArgs[index];
    if (CONFIG_PATH_ARG_FLAGS.has(arg)) {
      const nextArg = cliArgs[index + 1];
      if (nextArg) {
        configPaths.push(nextArg);
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("-c=")) {
      configPaths.push(arg.slice("-c=".length));
      continue;
    }
    if (arg.startsWith("--config=")) {
      configPaths.push(arg.slice("--config=".length));
    }
  }

  return configPaths;
}

export function shouldCleanStaleMacosDevBundle(cliArgs: string[]): boolean {
  return (
    cliArgs[0] === "dev" &&
    collectConfigArgs(cliArgs).some(
      (arg) => normalizePathForComparison(arg) === normalizePathForComparison(DEV_CONFIG_PATH),
    )
  );
}

export function hasMacosDevBundleIdentifierMarker(infoPlist: string): boolean {
  return (
    infoPlist.includes(MACOS_BUNDLE_IDENTIFIER_KEY_MARKER) &&
    infoPlist.includes(MACOS_DEV_BUNDLE_IDENTIFIER_VALUE_MARKER)
  );
}

export async function removeStaleMacosDevBundle(
  options: {
    cwd?: string;
    platform?: NodeJS.Platform;
    readFileImpl?: ReadFileImpl;
    rmImpl?: RmImpl;
    strict?: boolean;
    warnImpl?: WarnImpl;
  } = {},
): Promise<boolean> {
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const readFileImpl = options.readFileImpl ?? ((targetPath, encoding) => readFile(targetPath, encoding));
  const rmImpl = options.rmImpl ?? ((targetPath, rmOptions) => rm(targetPath, rmOptions));
  const warnImpl = options.warnImpl ?? ((message) => console.warn(message));

  if (platform !== "darwin") {
    return false;
  }

  const removableBundlePaths = (
    await Promise.all(
      STALE_MACOS_DEV_BUNDLE_PATHS.map(async (bundlePath) => {
        const infoPlistPath = path.join(cwd, bundlePath, "Contents", "Info.plist");
        let infoPlist = "";
        try {
          infoPlist = await readFileImpl(infoPlistPath, "utf8");
        } catch {
          return null;
        }

        return hasMacosDevBundleIdentifierMarker(infoPlist) ? bundlePath : null;
      }),
    )
  ).filter((bundlePath): bundlePath is string => bundlePath !== null);

  await Promise.all(
    removableBundlePaths.map(async (bundlePath) => {
      const targetPath = path.join(cwd, bundlePath);
      try {
        await rmImpl(targetPath, { recursive: true, force: true });
      } catch (error) {
        if (options.strict) {
          throw error;
        }
        warnImpl(
          `[tauri-cli-dispatch] stale macOS dev bundle cleanup skipped for ${targetPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }),
  );

  return removableBundlePaths.length > 0;
}

export function buildWslTauriSpawnSpec(
  cliArgs: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): SpawnSpec {
  return {
    ...buildWslWindowsSpawnSpec("pnpm", ["exec", "tauri", ...cliArgs], windowsCwd, envOverrides),
    env: envOverrides,
  };
}

export function buildChildEnvForSpawnSpec(
  spawnSpec: SpawnSpec,
  baseEnv: NodeJS.ProcessEnv = process.env,
  options: {
    platform?: NodeJS.Platform;
    cwd?: string;
    execPath?: string;
  } = {},
): NodeJS.ProcessEnv {
  const mergedEnv = spawnSpec.env ? { ...baseEnv, ...spawnSpec.env } : { ...baseEnv };
  return normalizeChildEnvForPlatform(mergedEnv, {
    platform: options.platform ?? process.platform,
    cwd: options.cwd ?? process.cwd(),
    execPath: options.execPath ?? process.execPath,
  });
}

function appendUniquePathParts(pathValue: string, pathParts: readonly string[]): string {
  const existingParts = pathValue.split(path.win32.delimiter).filter((part) => part.length > 0);
  const normalizedExistingParts = new Set(existingParts.map((part) => path.win32.normalize(part).toLowerCase()));

  for (const part of pathParts) {
    const normalizedPart = path.win32.normalize(part).toLowerCase();
    if (!normalizedExistingParts.has(normalizedPart)) {
      existingParts.unshift(part);
      normalizedExistingParts.add(normalizedPart);
    }
  }

  return existingParts.join(path.win32.delimiter);
}

export function normalizeChildEnvForPlatform(
  env: NodeJS.ProcessEnv,
  {
    platform = process.platform,
    cwd = process.cwd(),
    execPath = process.execPath,
  }: {
    platform?: NodeJS.Platform;
    cwd?: string;
    execPath?: string;
  } = {},
): NodeJS.ProcessEnv {
  if (platform !== "win32") {
    return env;
  }

  const pathKeys = Object.keys(env).filter((key) => key.toLowerCase() === "path");
  const preferredPathKey = pathKeys.includes("Path") ? "Path" : (pathKeys[0] ?? "Path");
  const pathValue = env[preferredPathKey] ?? "";

  for (const key of pathKeys) {
    if (key !== preferredPathKey) {
      delete env[key];
    }
  }

  env[preferredPathKey] = appendUniquePathParts(pathValue, [
    path.win32.dirname(execPath),
    path.win32.join(cwd, "node_modules", ".bin"),
  ]);

  return env;
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
    env: buildChildEnvForSpawnSpec(spawnSpec),
    shell: spawnSpec.shell,
    detached: shouldSpawnDetachedForSignalForwarding(process.platform),
  });

  const cleanupSignalForwarding = installSignalForwarding(child);

  child.on("exit", (code, signal) => {
    cleanupSignalForwarding();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    cleanupSignalForwarding();
    console.error("[tauri-cli-dispatch]", buildWindowsDispatchSpawnFailureMessage(spawnSpec.command, error));
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
