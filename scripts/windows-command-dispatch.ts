import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import os from "node:os";
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

export function buildLocalCommandSpawnSpec(command: string, args: string[]): SpawnSpec {
  return { command, args };
}

function buildPowerShellScript(
  command: string,
  args: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): string {
  const envAssignments = Object.entries(envOverrides).map(
    ([key, value]) => `$env:${key} = ${quotePowerShellLiteral(value)}`,
  );
  const commandLine = [command, ...args].map((arg) => quotePowerShellLiteral(arg)).join(" ");

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
    `& ${commandLine}`.trim(),
    "exit $LASTEXITCODE",
  ].join("; ");
}

export function buildWslWindowsCommandSpawnSpec(
  command: string,
  args: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): SpawnSpec {
  const powerShellScript = buildPowerShellScript(command, args, windowsCwd, envOverrides);
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

async function resolveSpawnSpec(command: string, args: string[]): Promise<SpawnSpec> {
  if (!isWslEnvironment()) {
    return buildLocalCommandSpawnSpec(command, args);
  }

  if (!(await canUseWindowsInterop())) {
    return buildLocalCommandSpawnSpec(command, args);
  }

  const windowsCwd = await convertWslPathToWindows(process.cwd());
  return buildWslWindowsCommandSpawnSpec(command, args, windowsCwd, pickWindowsEnvOverrides(process.env));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("[windows-command-dispatch] missing command");
    process.exit(1);
  }

  const spawnSpec = await resolveSpawnSpec(command, args);
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
    console.error("[windows-command-dispatch] failed to start command:", error);
    process.exit(1);
  });
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[windows-command-dispatch]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
