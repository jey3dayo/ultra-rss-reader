// @ts-check

import { execFile, spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import os from "node:os";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FORWARDED_ENV_PREFIXES = ["DEV_", "VITE_", "TAURI_", "RUST_"];

/**
 * @typedef {{ command: string; args: string[] }} SpawnSpec
 */

/**
 * @param {{ platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; osRelease?: string }} [options]
 * @returns {boolean}
 */
export function isWslEnvironment(options = {}) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const osRelease = options.osRelease ?? os.release();

  return platform === "linux" && (Boolean(env.WSL_INTEROP) || /microsoft/i.test(osRelease));
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string>}
 */
export function pickWindowsEnvOverrides(env = process.env) {
  return Object.entries(env).reduce(
    (overrides, [key, value]) => {
      if (typeof value === "string" && FORWARDED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        overrides[key] = value;
      }
      return overrides;
    },
    /** @type {Record<string, string>} */ ({}),
  );
}

/**
 * @param {string} value
 * @returns {string}
 */
function quotePowerShellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {SpawnSpec}
 */
export function buildLocalCommandSpawnSpec(command, args) {
  return { command, args };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} windowsCwd
 * @param {Record<string, string>} [envOverrides]
 * @returns {string}
 */
function buildPowerShellScript(command, args, windowsCwd, envOverrides = {}) {
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

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} windowsCwd
 * @param {Record<string, string>} [envOverrides]
 * @returns {SpawnSpec}
 */
export function buildWslWindowsCommandSpawnSpec(command, args, windowsCwd, envOverrides = {}) {
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

/**
 * @param {string} currentDirectory
 * @returns {Promise<string>}
 */
async function convertWslPathToWindows(currentDirectory) {
  const { stdout } = await execFileAsync("wslpath", ["-w", currentDirectory], { encoding: "utf8" });
  return stdout.trim();
}

/**
 * @returns {Promise<boolean>}
 */
async function canUseWindowsInterop() {
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

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<SpawnSpec>}
 */
async function resolveSpawnSpec(command, args) {
  if (!isWslEnvironment()) {
    return buildLocalCommandSpawnSpec(command, args);
  }

  if (!(await canUseWindowsInterop())) {
    return buildLocalCommandSpawnSpec(command, args);
  }

  const windowsCwd = await convertWslPathToWindows(process.cwd());
  return buildWslWindowsCommandSpawnSpec(command, args, windowsCwd, pickWindowsEnvOverrides(process.env));
}

async function main() {
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

  /**
   * @param {NodeJS.Signals} signal
   */
  const forwardSignal = (signal) => {
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

const isMainModule =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error("[windows-command-dispatch]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
