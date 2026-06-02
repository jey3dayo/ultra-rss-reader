import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import os from "node:os";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SECRET_ENV_SUFFIXES = ["_KEY", "_TOKEN", "_PASSWORD", "_SECRET", "_CREDENTIALS"];
const WINDOWS_DISPATCH_ENV_ALLOWLIST = [
  { key: "DEV_CREDENTIALS", kind: "devCredential" },
  { key: "RUST_BACKTRACE", kind: "passthrough" },
  { key: "RUST_LOG", kind: "passthrough" },
  { key: "TAURI_DEV_PORT", kind: "passthrough" },
  { key: "VITE_DEV_INTENT", kind: "passthrough" },
  { key: "VITE_DEV_WEB_URL", kind: "passthrough" },
  { key: "VITE_DEV_WINDOW_HEIGHT", kind: "passthrough" },
  { key: "VITE_DEV_WINDOW_WIDTH", kind: "passthrough" },
  { key: "VITE_ULTRA_RSS_DEV_INTENT", kind: "passthrough" },
  { key: "VITE_ULTRA_RSS_DEV_WEB_URL", kind: "passthrough" },
] as const satisfies readonly WindowsDispatchEnvRule[];
const EXPLICIT_FORWARDED_ENV_KEYS: ReadonlyMap<string, WindowsDispatchEnvRule> = new Map<
  string,
  WindowsDispatchEnvRule
>(WINDOWS_DISPATCH_ENV_ALLOWLIST.map((rule) => [rule.key, rule]));
const SECRET_LIKE_VALUE_PATTERN = /(?:^|[^a-z0-9])(?:ghp|github_pat|sk|xox[baprs]|AKIA)[a-z0-9_-]{8,}/i;

type WindowsDispatchEnvRule<Key extends string = string> = {
  key: Key;
  kind: "devCredential" | "passthrough";
};

type WindowsDispatchEnvSchema<Rules extends readonly WindowsDispatchEnvRule<string>[]> = Readonly<{
  [Rule in Rules[number] as Rule["key"]]: Rule["kind"];
}>;

export type WindowsDispatchEnvKey = (typeof WINDOWS_DISPATCH_ENV_ALLOWLIST)[number]["key"];

export const WINDOWS_DISPATCH_ENV_SCHEMA = Object.freeze({
  DEV_CREDENTIALS: "devCredential",
  RUST_BACKTRACE: "passthrough",
  RUST_LOG: "passthrough",
  TAURI_DEV_PORT: "passthrough",
  VITE_DEV_INTENT: "passthrough",
  VITE_DEV_WEB_URL: "passthrough",
  VITE_DEV_WINDOW_HEIGHT: "passthrough",
  VITE_DEV_WINDOW_WIDTH: "passthrough",
  VITE_ULTRA_RSS_DEV_INTENT: "passthrough",
  VITE_ULTRA_RSS_DEV_WEB_URL: "passthrough",
} satisfies WindowsDispatchEnvSchema<typeof WINDOWS_DISPATCH_ENV_ALLOWLIST>);

export type SpawnSpec = {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
};

type SignalForwardingChild = {
  killed: boolean;
  pid?: number;
  kill(signal: NodeJS.Signals): boolean;
};

type SignalForwardingProcess = {
  platform?: NodeJS.Platform;
  on(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): void;
  off(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): void;
  kill(pid: number, signal: NodeJS.Signals): boolean;
};

export function shouldSpawnDetachedForSignalForwarding(platform: NodeJS.Platform = process.platform): boolean {
  return platform !== "win32";
}

export function forwardSignalToChildProcessGroup(
  child: SignalForwardingChild,
  signal: NodeJS.Signals,
  targetProcess: Pick<SignalForwardingProcess, "kill" | "platform"> = process,
): void {
  if (child.killed) {
    return;
  }

  if ((targetProcess.platform ?? process.platform) !== "win32" && typeof child.pid === "number") {
    try {
      targetProcess.kill(-child.pid, signal);
      return;
    } catch {
      // The group may be gone already; fall back to the direct child handle.
    }
  }

  child.kill(signal);
}

export function installSignalForwarding(
  child: SignalForwardingChild,
  targetProcess: SignalForwardingProcess = process,
  signals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"],
): () => void {
  const forwardSignal = (signal: NodeJS.Signals): void => {
    forwardSignalToChildProcessGroup(child, signal, targetProcess);
  };

  for (const signal of signals) {
    targetProcess.on(signal, forwardSignal);
  }

  return () => {
    for (const signal of signals) {
      targetProcess.off(signal, forwardSignal);
    }
  };
}

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
    const rule = EXPLICIT_FORWARDED_ENV_KEYS.get(key);
    if (
      typeof value === "string" &&
      rule &&
      (rule.kind === "devCredential" ||
        (!SECRET_ENV_SUFFIXES.some((suffix) => key.endsWith(suffix)) && !isSecretLikeEnvValue(value)))
    ) {
      overrides[key] = value;
    }
  }

  return overrides;
}

export function isSecretLikeEnvValue(value: string): boolean {
  return SECRET_LIKE_VALUE_PATTERN.test(value);
}

function getErrorField(error: unknown, field: "code" | "path"): string | undefined {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return undefined;
  }

  const value = Reflect.get(error, field);
  return typeof value === "string" ? value : undefined;
}

function buildWindowsDispatchFailureMessage(stage: string, diagnostics: string[], error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `Windows dispatch failed (${[`stage: ${stage}`, ...diagnostics].join("; ")}): ${detail}`;
}

export function buildWindowsDispatchSpawnFailureMessage(command: string, error: unknown): string {
  const code = getErrorField(error, "code");
  const errorPath = getErrorField(error, "path");
  const diagnostics = [
    `command: ${command}`,
    code ? `code: ${code}` : null,
    errorPath ? `path: ${errorPath}` : null,
    "next action: verify the executable is installed, Windows Path is available, and the working directory is accessible from the selected shell",
  ].filter((item): item is string => item !== null);

  return buildWindowsDispatchFailureMessage("spawn", diagnostics, error);
}

export function buildWindowsPathConversionFailureMessage(currentDirectory: string, error: unknown): string {
  const diagnostics = [
    `cwd: ${currentDirectory}`,
    "next action: verify wslpath is installed and the current directory is accessible from Windows",
  ];

  return buildWindowsDispatchFailureMessage("path conversion", diagnostics, error);
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
  try {
    const { stdout } = await execFileAsync("wslpath", ["-w", currentDirectory], { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    throw new Error(buildWindowsPathConversionFailureMessage(currentDirectory, error));
  }
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
