#!/usr/bin/env node
// @ts-check

import { execFile, spawn } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_DEV_PORT = 1420;
const PORT_WAIT_TIMEOUT_MS = 10_000;
const PORT_WAIT_INTERVAL_MS = 250;

/**
 * @param {string} commandLine
 * @returns {"vite" | "foreign" | "unknown"}
 */
export function classifyPortOwnerCommandLine(commandLine) {
  const normalized = commandLine.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  if (/\bpnpm(?:\.cmd)?\s+exec\s+vite(?:\s|$)/.test(normalized)) {
    return "vite";
  }

  if (/[/\\]vite[/\\]bin[/\\]vite\.js(?:\s|$)/.test(normalized)) {
    return "vite";
  }

  return "foreign";
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {number[]} [allowedExitCodes]
 * @returns {Promise<string>}
 */
async function capture(command, args, allowedExitCodes = [0]) {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    const exitCode =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "number" ? error.code : -1;
    if (allowedExitCodes.includes(exitCode)) {
      const stdout =
        typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string"
          ? error.stdout
          : "";
      return stdout.trim();
    }

    throw error;
  }
}

/**
 * @param {number} port
 * @returns {Promise<{ pid: number; commandLine: string } | null>}
 */
async function getListeningProcess(port) {
  if (process.platform === "win32") {
    return getListeningProcessOnWindows(port);
  }

  return getListeningProcessOnUnix(port);
}

/**
 * @param {number} port
 * @returns {Promise<{ pid: number; commandLine: string } | null>}
 */
async function getListeningProcessOnUnix(port) {
  let pidText = "";
  try {
    pidText = await capture("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], [0, 1]);
  } catch (error) {
    const commandMissing =
      typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
    if (!commandMissing) {
      throw error;
    }
  }

  const pid = Number(pidText.split(/\s+/).find(Boolean));

  if (!Number.isFinite(pid)) {
    if (process.platform === "linux") {
      return getListeningProcessFromSs(port);
    }
    return null;
  }

  const commandLine = await capture("ps", ["-p", String(pid), "-o", "command="], [0, 1]);
  return { pid, commandLine };
}

/**
 * @param {number} port
 * @returns {Promise<{ pid: number; commandLine: string } | null>}
 */
async function getListeningProcessFromSs(port) {
  const output = await capture("ss", ["-ltnp", `sport = :${port}`], [0, 1]);
  const pidMatch = output.match(/pid=(\d+)/);

  if (!pidMatch) {
    return null;
  }

  const pid = Number(pidMatch[1]);
  const commandLine = await capture("ps", ["-p", String(pid), "-o", "command="], [0, 1]);
  return { pid, commandLine };
}

/**
 * @param {number} port
 * @returns {Promise<{ pid: number; commandLine: string } | null>}
 */
async function getListeningProcessOnWindows(port) {
  const pidText = await capture(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)`,
    ],
    [0],
  );

  const pid = Number(pidText.split(/\s+/).find(Boolean));
  if (!Number.isFinite(pid)) {
    return null;
  }

  const commandLine = await capture(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine)`,
    ],
    [0],
  );

  return { pid, commandLine };
}

/**
 * @param {number} port
 * @returns {Promise<void>}
 */
async function waitForPortToBeFree(port) {
  const deadline = Date.now() + PORT_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const processInfo = await getListeningProcess(port);
    if (!processInfo) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, PORT_WAIT_INTERVAL_MS));
  }

  throw new Error(`Timed out waiting for port ${port} to become available`);
}

/**
 * @param {number} pid
 * @returns {void}
 */
function stopProcess(pid) {
  process.kill(pid, "SIGTERM");
}

/**
 * @param {string[]} args
 * @returns {boolean}
 */
function isCheckMode(args) {
  return args.includes("--check");
}

async function main() {
  const port = Number(process.env.TAURI_DEV_PORT ?? String(DEFAULT_DEV_PORT));
  const existingProcess = await getListeningProcess(port);

  if (existingProcess) {
    const ownerKind = classifyPortOwnerCommandLine(existingProcess.commandLine);
    if (ownerKind !== "vite") {
      throw new Error(
        `Port ${port} is already in use by another process (pid ${existingProcess.pid}): ${existingProcess.commandLine || "unknown"}`,
      );
    }

    console.log(`[tauri-dev-vite-manager] stopping existing Vite dev server on port ${port} (pid ${existingProcess.pid})`);
    stopProcess(existingProcess.pid);
    await waitForPortToBeFree(port);
  }

  if (isCheckMode(process.argv.slice(2))) {
    console.log(`[tauri-dev-vite-manager] port ${port} is ready`);
    return;
  }

  const viteCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(viteCommand, ["exec", "vite"], {
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
    console.error("[tauri-dev-vite-manager] failed to start Vite:", error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("[tauri-dev-vite-manager]", error instanceof Error ? error.message : error);
  process.exit(1);
});
