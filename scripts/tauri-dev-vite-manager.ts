import { execFile, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_DEV_PORT = 1420;
const DEFAULT_DEV_HOST = "127.0.0.1";
const PORT_WAIT_TIMEOUT_MS = 10_000;
const PORT_WAIT_INTERVAL_MS = 250;

type PortOwnerKind = "vite" | "foreign" | "unknown";

type SpawnSpec = {
  command: string;
  args: string[];
};

type ListeningProcess = {
  pid: number;
  commandLine: string;
};

export function classifyPortOwnerCommandLine(commandLine: string): PortOwnerKind {
  const normalized = commandLine.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  if (/\bpnpm(?:\.cmd)?\s+exec\s+vite(?:\s|$)/.test(normalized)) {
    return "vite";
  }

  if (/[/\\]vite[/\\]bin[/\\]vite\.js(?:"|\s|$)/.test(normalized)) {
    return "vite";
  }

  return "foreign";
}

export function buildViteSpawnSpec(scriptUrl: string = import.meta.url): SpawnSpec {
  return {
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../node_modules/vite/bin/vite.js", scriptUrl)),
      "--host",
      DEFAULT_DEV_HOST,
      "--port",
      String(DEFAULT_DEV_PORT),
      "--strictPort",
    ],
  };
}

function getExecErrorCode(error: unknown): number | string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof error.code === "number" || typeof error.code === "string")
    ? error.code
    : -1;
}

function getExecErrorExitCode(error: unknown): number {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
    ? error.code
    : -1;
}

function getExecErrorStdout(error: unknown): string {
  return typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string"
    ? error.stdout
    : "";
}

async function capture(command: string, args: string[], allowedExitCodes: number[] = [0]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error: unknown) {
    const exitCode = getExecErrorExitCode(error);
    if (allowedExitCodes.includes(exitCode)) {
      return getExecErrorStdout(error).trim();
    }

    throw error;
  }
}

async function getListeningProcess(port: number): Promise<ListeningProcess | null> {
  if (process.platform === "win32") {
    return getListeningProcessOnWindows(port);
  }

  return getListeningProcessOnUnix(port);
}

async function getListeningProcessOnUnix(port: number): Promise<ListeningProcess | null> {
  let pidText = "";
  try {
    pidText = await capture("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], [0, 1]);
  } catch (error: unknown) {
    if (getExecErrorCode(error) !== "ENOENT") {
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

async function getListeningProcessFromSs(port: number): Promise<ListeningProcess | null> {
  const output = await capture("ss", ["-ltnp", `sport = :${port}`], [0, 1]);
  const pidMatch = output.match(/pid=(\d+)/);

  if (!pidMatch) {
    return null;
  }

  const pid = Number(pidMatch[1]);
  const commandLine = await capture("ps", ["-p", String(pid), "-o", "command="], [0, 1]);
  return { pid, commandLine };
}

async function getListeningProcessOnWindows(port: number): Promise<ListeningProcess | null> {
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

async function waitForPortToBeFree(port: number): Promise<void> {
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

function stopProcess(pid: number): void {
  process.kill(pid, "SIGTERM");
}

function isCheckMode(args: string[]): boolean {
  return args.includes("--check");
}

async function main(): Promise<void> {
  const port = Number(process.env.TAURI_DEV_PORT ?? String(DEFAULT_DEV_PORT));
  const existingProcess = await getListeningProcess(port);

  if (existingProcess) {
    const ownerKind = classifyPortOwnerCommandLine(existingProcess.commandLine);
    if (ownerKind !== "vite") {
      throw new Error(
        `Port ${port} is already in use by another process (pid ${existingProcess.pid}): ${existingProcess.commandLine || "unknown"}`,
      );
    }

    console.log(
      `[tauri-dev-vite-manager] stopping existing Vite dev server on port ${port} (pid ${existingProcess.pid})`,
    );
    stopProcess(existingProcess.pid);
    await waitForPortToBeFree(port);
  }

  if (isCheckMode(process.argv.slice(2))) {
    console.log(`[tauri-dev-vite-manager] port ${port} is ready`);
    return;
  }

  const viteSpawnSpec = buildViteSpawnSpec();
  const child = spawn(viteSpawnSpec.command, viteSpawnSpec.args, {
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
    console.error("[tauri-dev-vite-manager] failed to start Vite:", error);
    process.exit(1);
  });
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[tauri-dev-vite-manager]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
