// @ts-check

import { execFile, spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import os from "node:os";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
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
 * @param {string[]} cliArgs
 * @param {string} [scriptUrl]
 * @returns {SpawnSpec}
 */
export function buildLocalTauriSpawnSpec(cliArgs, scriptUrl = import.meta.url) {
  return {
    command: process.execPath,
    args: [fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", scriptUrl)), ...cliArgs],
  };
}

/**
 * @param {string[]} cliArgs
 * @param {string} windowsCwd
 * @param {Record<string, string>} [envOverrides]
 * @returns {string}
 */
function buildPowerShellScript(cliArgs, windowsCwd, envOverrides = {}) {
  const envAssignments = Object.entries(envOverrides).map(
    ([key, value]) => `$env:${key} = ${quotePowerShellLiteral(value)}`,
  );
  const tauriArgs = cliArgs.map((arg) => quotePowerShellLiteral(arg)).join(" ");
  return [
    "$ErrorActionPreference = 'Stop'",
    `Set-Location -LiteralPath ${quotePowerShellLiteral(windowsCwd)}`,
    ...envAssignments,
    `& node '.\\node_modules\\@tauri-apps\\cli\\tauri.js' ${tauriArgs}`.trim(),
    "exit $LASTEXITCODE",
  ].join("; ");
}

/**
 * @param {string[]} cliArgs
 * @param {string} windowsCwd
 * @param {Record<string, string>} [envOverrides]
 * @returns {SpawnSpec}
 */
export function buildWslTauriSpawnSpec(cliArgs, windowsCwd, envOverrides = {}) {
  const powerShellScript = buildPowerShellScript(cliArgs, windowsCwd, envOverrides);
  const encodedCommand = Buffer.from(powerShellScript, "utf16le").toString("base64");
  return {
    command: "sh",
    args: ["-lc", `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`],
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
    await execFileAsync(
      "sh",
      ["-lc", "powershell.exe -NoProfile -Command \"exit 0\""],
      { timeout: 5_000, encoding: "utf8" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string[]} cliArgs
 * @returns {Promise<SpawnSpec>}
 */
async function resolveSpawnSpec(cliArgs) {
  if (!isWslEnvironment()) {
    return buildLocalTauriSpawnSpec(cliArgs);
  }

  if (!(await canUseWindowsInterop())) {
    return buildLocalTauriSpawnSpec(cliArgs);
  }

  const windowsCwd = await convertWslPathToWindows(process.cwd());
  return buildWslTauriSpawnSpec(cliArgs, windowsCwd, pickWindowsEnvOverrides(process.env));
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const spawnSpec = await resolveSpawnSpec(cliArgs);
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
    console.error("[tauri-cli-dispatch] failed to start Tauri CLI:", error);
    process.exit(1);
  });
}

const isMainModule =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error("[tauri-cli-dispatch]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
