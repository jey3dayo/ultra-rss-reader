import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FORWARDED_ENV_PREFIXES = ["DEV_", "VITE_", "TAURI_", "RUST_"];

type SpawnSpec = {
  command: string;
  args: string[];
};

type WslEnvironmentOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  osRelease?: string;
};

type ReadFileImpl = (targetPath: string, encoding: "utf8") => Promise<string>;
type RmImpl = (targetPath: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;

export function isWslEnvironment(options: WslEnvironmentOptions = {}): boolean {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const osRelease = options.osRelease ?? os.release();

  return platform === "linux" && (Boolean(env.WSL_INTEROP) || /microsoft/i.test(osRelease));
}

export function pickWindowsEnvOverrides(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const overrides: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && FORWARDED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      overrides[key] = value;
    }
  }

  return overrides;
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

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

function buildPowerShellScript(
  cliArgs: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): string {
  const envAssignments = Object.entries(envOverrides).map(
    ([key, value]) => `$env:${key} = ${quotePowerShellLiteral(value)}`,
  );
  const tauriArgs = cliArgs.map((arg) => quotePowerShellLiteral(arg)).join(" ");
  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "$OutputEncoding = [System.Text.UTF8Encoding]::new()",
    "$env:HOME = $env:USERPROFILE",
    "$pathParts = @([Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User'))",
    "$env:Path = ($pathParts | Where-Object { $_ }) -join ';'",
    `Set-Location -LiteralPath ${quotePowerShellLiteral(windowsCwd)}`,
    ...envAssignments,
    `& pnpm exec tauri ${tauriArgs}`.trim(),
    "exit $LASTEXITCODE",
  ].join("; ");
}

export function buildWslTauriSpawnSpec(
  cliArgs: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): SpawnSpec {
  const powerShellScript = buildPowerShellScript(cliArgs, windowsCwd, envOverrides);
  const encodedCommand = Buffer.from(powerShellScript, "utf16le").toString("base64");
  return {
    command: "sh",
    args: [
      "-lc",
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand ${encodedCommand}`,
    ],
  };
}

async function convertWslPathToWindows(currentDirectory: string): Promise<string> {
  const { stdout } = await execFileAsync("wslpath", ["-w", currentDirectory], { encoding: "utf8" });
  return stdout.trim();
}

async function canUseWindowsInterop(): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-lc", 'powershell.exe -NoProfile -Command "exit 0"'], {
      timeout: 5_000,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
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
