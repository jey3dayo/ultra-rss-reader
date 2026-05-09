import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FORWARDED_ENV_PREFIXES = ["DEV_", "VITE_", "TAURI_", "RUST_"];
const SECRET_ENV_SUFFIXES = ["_KEY", "_TOKEN", "_PASSWORD"];

export type SpawnSpec = {
  command: string;
  args: string[];
  shell?: boolean;
};

export type WslEnvironmentOptions = {
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
    if (
      typeof value === "string" &&
      FORWARDED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
      !SECRET_ENV_SUFFIXES.some((suffix) => key.endsWith(suffix))
    ) {
      overrides[key] = value;
    }
  }

  return overrides;
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function buildPowerShellScript(
  command: string,
  args: string[],
  windowsCwd: string,
  envOverrides: Record<string, string>,
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

export function buildWslWindowsSpawnSpec(
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

export async function convertWslPathToWindows(currentDirectory: string): Promise<string> {
  const { stdout } = await execFileAsync("wslpath", ["-w", currentDirectory], { encoding: "utf8" });
  return stdout.trim();
}

export async function canUseWindowsInterop(): Promise<boolean> {
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
