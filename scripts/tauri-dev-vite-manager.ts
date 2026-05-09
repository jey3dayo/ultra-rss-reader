import { execFile, spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_DEV_PORT = 1420;
const DEFAULT_DEV_HOST = "127.0.0.1";
const PORT_WAIT_TIMEOUT_MS = 10_000;
const PORT_WAIT_INTERVAL_MS = 250;
const MAX_TCP_PORT = 65_535;

type PortOwnerKind = "vite" | "foreign" | "unknown";

type SpawnSpec = {
  command: string;
  args: string[];
};

type ManagedChildProcess = {
  killed: boolean;
  kill(signal: NodeJS.Signals): boolean;
  on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
};

type SpawnImpl = (
  command: string,
  args: string[],
  options: { stdio: "inherit"; env: NodeJS.ProcessEnv },
) => ManagedChildProcess;

type ListeningProcess = {
  pid: number;
  commandLine: string;
  cwd?: string;
};

type ManagerResult = "checked" | "spawned";

type TauriDevViteManagerOptions = {
  args?: string[];
  env?: NodeJS.ProcessEnv;
  scriptUrl?: string;
  getListeningProcessImpl?: (port: number) => Promise<ListeningProcess | null>;
  stopProcessImpl?: (pid: number) => void;
  forceStopProcessImpl?: (pid: number) => void;
  waitForPortToBeFreeImpl?: (port: number) => Promise<void>;
  spawnImpl?: SpawnImpl;
  log?: (message: string) => void;
};

type PortOwnerProcess = {
  commandLine: string;
  cwd?: string;
};

type ExpectedViteOwner = {
  port: number;
  packageRoot: string;
};

function normalizePathForComparison(value: string): string {
  const slashPath = value.replaceAll("\\", "/").replace(/\/+$/, "");
  if (/^[a-zA-Z]:\//.test(slashPath)) {
    return slashPath.toLowerCase();
  }

  return path.resolve(slashPath).replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

function splitCommandLine(commandLine: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g;
  let match = pattern.exec(commandLine);
  while (match !== null) {
    args.push(match[1] ?? match[2] ?? match[3] ?? "");
    match = pattern.exec(commandLine);
  }

  return args;
}

function hasExpectedVitePort(commandArgs: readonly string[], port: number): boolean {
  const expectedPort = String(port);

  return commandArgs.some((arg, index) => {
    if (arg === "--port") {
      return commandArgs[index + 1] === expectedPort;
    }

    return arg === `--port=${expectedPort}`;
  });
}

function commandArgsReferencePackageRoot(commandArgs: readonly string[], packageRoot: string): boolean {
  const normalizedPackageRoot = normalizePathForComparison(packageRoot);

  return commandArgs.some((arg) => {
    const normalizedArg = normalizePathForComparison(arg);
    return (
      normalizedArg === normalizedPackageRoot ||
      normalizedArg.startsWith(`${normalizedPackageRoot}/node_modules/`) ||
      normalizedArg.startsWith(`${normalizedPackageRoot}/.pnpm/`)
    );
  });
}

function resolvePackageRoot(scriptUrl: string): string {
  return path.resolve(fileURLToPath(new URL("..", scriptUrl)));
}

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

export function classifyPortOwner(processInfo: PortOwnerProcess, expectedOwner: ExpectedViteOwner): PortOwnerKind {
  const ownerKind = classifyPortOwnerCommandLine(processInfo.commandLine);
  if (ownerKind !== "vite") {
    return ownerKind;
  }

  const commandArgs = splitCommandLine(processInfo.commandLine);
  if (processInfo.cwd) {
    if (normalizePathForComparison(processInfo.cwd) !== normalizePathForComparison(expectedOwner.packageRoot)) {
      return "foreign";
    }
  } else if (!commandArgsReferencePackageRoot(commandArgs, expectedOwner.packageRoot)) {
    return "foreign";
  }

  if (!hasExpectedVitePort(commandArgs, expectedOwner.port)) {
    return "foreign";
  }

  return "vite";
}

export function buildViteSpawnSpec(scriptUrl: string = import.meta.url, port: number = DEFAULT_DEV_PORT): SpawnSpec {
  return {
    command: process.execPath,
    args: [
      fileURLToPath(new URL("../node_modules/vite/bin/vite.js", scriptUrl)),
      "--host",
      DEFAULT_DEV_HOST,
      "--port",
      String(port),
      "--strictPort",
    ],
  };
}

export function resolveTauriDevPort(env: NodeJS.ProcessEnv = process.env): number {
  const rawPort = env.TAURI_DEV_PORT;
  if (rawPort === undefined) {
    return DEFAULT_DEV_PORT;
  }

  const trimmedPort = rawPort.trim();
  const port = Number(trimmedPort);
  if (!trimmedPort || !Number.isInteger(port) || port <= 0 || port > MAX_TCP_PORT) {
    throw new Error("TAURI_DEV_PORT must be an integer between 1 and 65535.");
  }

  return port;
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

export function buildPortWaitTimeoutMessage(options: {
  port: number;
  elapsedMs: number;
  lastProcess: ListeningProcess | null;
}): string {
  const processDetail = options.lastProcess
    ? `last listener pid ${options.lastProcess.pid}: ${options.lastProcess.commandLine || "unknown command"}`
    : "no listener details were available";

  return [
    `Timed out waiting for port ${options.port} to become available after ${options.elapsedMs}ms`,
    `Checked port: ${options.port}`,
    `Last listener: ${processDetail}`,
    "Next action: stop the stale Vite process, free the configured TAURI_DEV_PORT, or rerun with a supported Node/Vite environment.",
  ].join(". ");
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

  const [commandLine, cwd] = await Promise.all([
    capture("ps", ["-p", String(pid), "-o", "command="], [0, 1]),
    getProcessCwdOnUnix(pid),
  ]);
  return { pid, commandLine, cwd };
}

async function getListeningProcessFromSs(port: number): Promise<ListeningProcess | null> {
  const output = await capture("ss", ["-ltnp", `sport = :${port}`], [0, 1]);
  const pidMatch = output.match(/pid=(\d+)/);

  if (!pidMatch) {
    return null;
  }

  const pid = Number(pidMatch[1]);
  const [commandLine, cwd] = await Promise.all([
    capture("ps", ["-p", String(pid), "-o", "command="], [0, 1]),
    getProcessCwdOnUnix(pid),
  ]);
  return { pid, commandLine, cwd };
}

async function getProcessCwdOnUnix(pid: number): Promise<string | undefined> {
  if (process.platform === "linux") {
    try {
      const cwd = await capture("pwdx", [String(pid)], [0, 1]);
      const cwdMatch = cwd.match(/^\d+:\s*(.+)$/);
      return cwdMatch?.[1]?.trim() || undefined;
    } catch (error: unknown) {
      if (getExecErrorCode(error) !== "ENOENT") {
        throw error;
      }
    }
  }

  try {
    const cwdOutput = await capture("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], [0, 1]);
    const cwdLine = cwdOutput.split(/\r?\n/).find((line) => line.startsWith("n"));
    return cwdLine?.slice(1).trim() || undefined;
  } catch (error: unknown) {
    if (getExecErrorCode(error) !== "ENOENT") {
      throw error;
    }
    return undefined;
  }
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
  const startedAt = Date.now();
  const deadline = startedAt + PORT_WAIT_TIMEOUT_MS;
  let lastProcess: ListeningProcess | null = null;

  // Poll sequentially so each check observes the port after the previous wait interval.
  while (Date.now() < deadline) {
    const processInfo = await getListeningProcess(port);
    if (!processInfo) {
      return;
    }
    lastProcess = processInfo;

    await new Promise((resolve) => setTimeout(resolve, PORT_WAIT_INTERVAL_MS));
  }

  throw new Error(
    buildPortWaitTimeoutMessage({
      port,
      elapsedMs: Date.now() - startedAt,
      lastProcess,
    }),
  );
}

function stopProcess(pid: number): void {
  process.kill(pid, "SIGTERM");
}

function forceStopProcess(pid: number): void {
  process.kill(pid, "SIGKILL");
}

function isCheckMode(args: string[]): boolean {
  return args.includes("--check");
}

export async function runTauriDevViteManager({
  args = process.argv.slice(2),
  env = process.env,
  scriptUrl = import.meta.url,
  getListeningProcessImpl = getListeningProcess,
  stopProcessImpl = stopProcess,
  forceStopProcessImpl = forceStopProcess,
  waitForPortToBeFreeImpl = waitForPortToBeFree,
  spawnImpl = spawn,
  log = console.log,
}: TauriDevViteManagerOptions = {}): Promise<ManagerResult> {
  const port = resolveTauriDevPort(env);
  const packageRoot = resolvePackageRoot(scriptUrl);
  const checkMode = isCheckMode(args);
  const existingProcess = await getListeningProcessImpl(port);

  if (existingProcess) {
    const ownerKind = classifyPortOwner(existingProcess, { packageRoot, port });
    if (ownerKind !== "vite") {
      throw new Error(
        `Port ${port} is already in use by another process (pid ${existingProcess.pid}): ${existingProcess.commandLine || "unknown"}`,
      );
    }

    if (checkMode) {
      log(`[tauri-dev-vite-manager] existing Vite dev server is ready on port ${port} (pid ${existingProcess.pid})`);
      return "checked";
    }

    log(`[tauri-dev-vite-manager] stopping existing Vite dev server on port ${port} (pid ${existingProcess.pid})`);
    stopProcessImpl(existingProcess.pid);
    try {
      await waitForPortToBeFreeImpl(port);
    } catch (_error) {
      log(
        `[tauri-dev-vite-manager] existing Vite dev server did not stop after SIGTERM; sending SIGKILL to pid ${existingProcess.pid}`,
      );
      forceStopProcessImpl(existingProcess.pid);
      await waitForPortToBeFreeImpl(port);
    }
  }

  if (checkMode) {
    log(`[tauri-dev-vite-manager] port ${port} is ready`);
    return "checked";
  }

  const viteSpawnSpec = buildViteSpawnSpec(scriptUrl, port);
  const child = spawnImpl(viteSpawnSpec.command, viteSpawnSpec.args, {
    stdio: "inherit",
    env,
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

  return "spawned";
}

async function main(): Promise<void> {
  await runTauriDevViteManager();
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[tauri-dev-vite-manager]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
