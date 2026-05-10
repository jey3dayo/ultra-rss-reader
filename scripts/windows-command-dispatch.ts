import { spawn } from "node:child_process";
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

export function buildLocalCommandSpawnSpec(command: string, args: string[]): SpawnSpec {
  return { command, args };
}

export function buildWslWindowsCommandSpawnSpec(
  command: string,
  args: string[],
  windowsCwd: string,
  envOverrides: Record<string, string> = {},
): SpawnSpec {
  return buildWslWindowsSpawnSpec(command, args, windowsCwd, envOverrides);
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
    console.error("[windows-command-dispatch]", buildWindowsDispatchSpawnFailureMessage(spawnSpec.command, error));
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
