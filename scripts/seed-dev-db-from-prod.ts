import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Result } from "@praha/byethrow";

type SeedPlatform = "darwin" | "win32" | "linux" | NodeJS.Platform;
type ExecFileAsync = (
  command: string,
  args: readonly string[],
  options: { encoding: "utf8"; timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;
type AccessImpl = (targetPath: string, mode?: number) => Promise<void>;
type CopyFileImpl = (source: string, destination: string) => Promise<void>;
type MkdirImpl = (targetPath: string, options: { recursive: true }) => Promise<string | undefined>;
type RmImpl = (targetPath: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;

export type SeedArtifact = {
  source: string;
  destination: string;
  backup: string;
  staging: string;
  suffix: string;
};

export type SeedPlan = {
  prodAppDataDir: string;
  devAppDataDir: string;
  backupDir: string;
  stagingDir: string;
  artifacts: SeedArtifact[];
};

export const PROD_APP_IDENTIFIER = "com.jey3dayo.ultra-rss-reader";
export const DEV_APP_IDENTIFIER = "com.ultra-rss-reader.dev";
export const DATABASE_FILE_NAME = "ultra-rss-reader.db";
const DATABASE_SUFFIXES = ["", "-wal", "-shm"] as const;

const promisifiedExecFile = promisify(execFile);
const execFileAsync: ExecFileAsync = async (command, args, options) => {
  const { stdout, stderr } = await promisifiedExecFile(command, [...args], options);
  return { stdout: String(stdout), stderr: String(stderr) };
};

function processDetectionError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to check whether Ultra RSS Reader is running: ${detail}`);
}

function databaseHandleDetectionError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to check whether the Dev database is open: ${detail}`);
}

function readConfiguredEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

export function resolveAppDataDir(options: {
  platform?: SeedPlatform;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  identifier: string;
}): string {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", options.identifier);
  }

  if (platform === "win32") {
    const roamingAppData = readConfiguredEnvValue(env, "APPDATA") ?? path.join(homeDir, "AppData", "Roaming");
    return path.join(roamingAppData, options.identifier);
  }

  const dataHome = readConfiguredEnvValue(env, "XDG_DATA_HOME") ?? path.join(homeDir, ".local", "share");
  return path.join(dataHome, options.identifier);
}

export function buildDatabaseArtifactPaths(appDataDir: string): string[] {
  return DATABASE_SUFFIXES.map((suffix) => path.join(appDataDir, `${DATABASE_FILE_NAME}${suffix}`));
}

export function resolveBackupDirName(timestamp: string): string {
  return `seed-from-prod-${timestamp}`;
}

export function buildSeedPlan(options: {
  prodAppDataDir: string;
  devAppDataDir: string;
  timestamp?: string;
}): SeedPlan {
  const timestamp = options.timestamp ?? formatTimestamp(new Date());
  const backupDir = path.join(options.devAppDataDir, "backups", resolveBackupDirName(timestamp));
  const stagingDir = `${backupDir}.staging`;

  return {
    prodAppDataDir: options.prodAppDataDir,
    devAppDataDir: options.devAppDataDir,
    backupDir,
    stagingDir,
    artifacts: DATABASE_SUFFIXES.map((suffix) => ({
      suffix,
      source: path.join(options.prodAppDataDir, `${DATABASE_FILE_NAME}${suffix}`),
      destination: path.join(options.devAppDataDir, `${DATABASE_FILE_NAME}${suffix}`),
      backup: path.join(backupDir, `${DATABASE_FILE_NAME}${suffix}`),
      staging: path.join(stagingDir, `${DATABASE_FILE_NAME}${suffix}`),
    })),
  };
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

async function fileExists(targetPath: string, accessImpl: AccessImpl): Promise<boolean> {
  try {
    await accessImpl(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveSeedAppDataDirs(
  options: { env?: NodeJS.ProcessEnv; platform?: SeedPlatform; homeDir?: string } = {},
): { prodAppDataDir: string; devAppDataDir: string } {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const prodAppDataDir = readConfiguredEnvValue(env, "ULTRA_RSS_PROD_APP_DATA_DIR");
  const devAppDataDir = readConfiguredEnvValue(env, "ULTRA_RSS_DEV_APP_DATA_DIR");

  return {
    prodAppDataDir:
      prodAppDataDir ??
      resolveAppDataDir({
        platform,
        homeDir,
        env,
        identifier: PROD_APP_IDENTIFIER,
      }),
    devAppDataDir:
      devAppDataDir ??
      resolveAppDataDir({
        platform,
        homeDir,
        env,
        identifier: DEV_APP_IDENTIFIER,
      }),
  };
}

export async function listLikelyRunningAppProcesses(
  options: { platform?: SeedPlatform; execFileImpl?: ExecFileAsync } = {},
): Promise<string[]> {
  const result = await detectLikelyRunningAppProcesses(options);
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }

  return Result.unwrap(result);
}

export async function detectLikelyRunningAppProcesses(
  options: { platform?: SeedPlatform; execFileImpl?: ExecFileAsync } = {},
): Promise<Result.Result<string[], Error>> {
  const platform = options.platform ?? process.platform;
  const execFileImpl = options.execFileImpl ?? execFileAsync;

  if (platform === "darwin" || platform === "linux") {
    const processNames = ["Ultra RSS Reader", "Ultra RSS Reader Dev", "ultra-rss-reader"];
    const checks = await Promise.all(
      processNames.map((processName) => checkUnixProcessName(processName, execFileImpl)),
    );

    for (const check of checks) {
      if (check.error === null) {
        continue;
      }

      if (!isProcessNotFoundError(check.error)) {
        return Result.fail(processDetectionError(check.error));
      }
    }

    return Result.succeed(checks.flatMap((check) => (check.error === null ? [check.processName] : [])));
  }

  if (platform === "win32") {
    try {
      const { stdout } = await execFileImpl("tasklist", ["/FO", "CSV", "/NH"], {
        encoding: "utf8",
      });
      return Result.succeed(
        stdout
          .split(/\r?\n/)
          .filter((line) => /Ultra RSS Reader(?: Dev)?\.exe/i.test(line) || /ultra-rss-reader\.exe/i.test(line)),
      );
    } catch (error) {
      return Result.fail(processDetectionError(error));
    }
  }

  return Result.succeed([]);
}

async function checkUnixProcessName(
  processName: string,
  execFileImpl: ExecFileAsync,
): Promise<{ processName: string; error: unknown | null }> {
  try {
    await execFileImpl("pgrep", ["-x", processName], { encoding: "utf8" });
    return { processName, error: null };
  } catch (exactError) {
    if (!isProcessNotFoundError(exactError)) {
      return { processName, error: exactError };
    }

    if (!processName.includes(" ")) {
      return { processName, error: exactError };
    }
  }

  try {
    await execFileImpl("pgrep", ["-f", processName], { encoding: "utf8" });
    return { processName, error: null };
  } catch (fullCommandLineError) {
    return { processName, error: fullCommandLineError };
  }
}

function isProcessNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === 1 || error.code === "1");
}

export async function detectOpenDevDatabaseHandles(options: {
  platform?: SeedPlatform;
  artifactPaths: readonly string[];
  execFileImpl?: ExecFileAsync;
}): Promise<Result.Result<string[], Error>> {
  const platform = options.platform ?? process.platform;
  const execFileImpl = options.execFileImpl ?? execFileAsync;

  if (platform !== "darwin" && platform !== "linux") {
    return Result.succeed([]);
  }

  const checks = await Promise.all(
    options.artifactPaths.map(async (artifactPath) => {
      try {
        const { stdout } = await execFileImpl("lsof", ["-t", artifactPath], {
          encoding: "utf8",
          timeout: 5000,
        });
        return { artifactPath, stdout, error: null };
      } catch (error) {
        return { artifactPath, stdout: "", error };
      }
    }),
  );

  for (const check of checks) {
    if (check.error === null) {
      continue;
    }

    if (!isProcessNotFoundError(check.error)) {
      return Result.fail(databaseHandleDetectionError(check.error));
    }
  }

  return Result.succeed(
    checks.flatMap((check) => (check.error === null && check.stdout.trim().length > 0 ? [check.artifactPath] : [])),
  );
}

function assertSafeDevTarget(plan: SeedPlan): void {
  if (path.basename(path.resolve(plan.devAppDataDir)) === PROD_APP_IDENTIFIER) {
    throw new Error("Refusing to seed a non-Dev app data directory.");
  }
}

export async function seedDevDatabaseFromProdPlan(
  plan: SeedPlan,
  options: {
    accessImpl?: AccessImpl;
    copyFileImpl?: CopyFileImpl;
    mkdirImpl?: MkdirImpl;
    rmImpl?: RmImpl;
  } = {},
): Promise<{ copied: string[]; backedUp: string[]; backupDir: string }> {
  const accessImpl = options.accessImpl ?? access;
  const copyFileImpl = options.copyFileImpl ?? copyFile;
  const mkdirImpl = options.mkdirImpl ?? mkdir;
  const rmImpl = options.rmImpl ?? rm;
  const mainArtifact = plan.artifacts[0];

  if (!mainArtifact) {
    throw new Error("No database artifacts are configured.");
  }

  if (path.resolve(plan.prodAppDataDir) === path.resolve(plan.devAppDataDir)) {
    throw new Error("Production and Dev app data directories resolve to the same path.");
  }

  assertSafeDevTarget(plan);

  await accessImpl(mainArtifact.source, fsConstants.R_OK);

  const sourceArtifacts = (
    await Promise.all(
      plan.artifacts.map(async (artifact) => {
        if (!(await fileExists(artifact.source, accessImpl))) {
          return null;
        }
        await accessImpl(artifact.source, fsConstants.R_OK);
        return artifact;
      }),
    )
  ).filter((artifact): artifact is SeedArtifact => artifact !== null);

  await rmImpl(plan.stagingDir, { recursive: true, force: true });
  await mkdirImpl(plan.stagingDir, { recursive: true });

  try {
    await Promise.all(sourceArtifacts.map((artifact) => copyFileImpl(artifact.source, artifact.staging)));

    // Keep replacement phases ordered: staging copy, backup, destination cleanup, then install.
    await mkdirImpl(plan.backupDir, { recursive: true });
    const backedUp = (
      await Promise.all(
        plan.artifacts.map(async (artifact) => {
          if (!(await fileExists(artifact.destination, accessImpl))) {
            return null;
          }

          await accessImpl(artifact.destination, fsConstants.R_OK);
          await copyFileImpl(artifact.destination, artifact.backup);
          return artifact.destination;
        }),
      )
    ).filter((destination): destination is string => destination !== null);

    await mkdirImpl(plan.devAppDataDir, { recursive: true });
    await Promise.all(plan.artifacts.map((artifact) => rmImpl(artifact.destination, { force: true })));

    await Promise.all(sourceArtifacts.map((artifact) => copyFileImpl(artifact.staging, artifact.destination)));

    return {
      copied: sourceArtifacts.map((artifact) => artifact.destination),
      backedUp,
      backupDir: plan.backupDir,
    };
  } finally {
    await rmImpl(plan.stagingDir, { recursive: true, force: true });
  }
}

export async function seedDevDatabaseFromProd(
  options: { env?: NodeJS.ProcessEnv; platform?: SeedPlatform; homeDir?: string; execFileImpl?: ExecFileAsync } = {},
): Promise<{ copied: string[]; backedUp: string[]; backupDir: string }> {
  const platform = options.platform ?? process.platform;
  const runningProcessesResult = await detectLikelyRunningAppProcesses({
    platform,
    execFileImpl: options.execFileImpl,
  });
  if (Result.isFailure(runningProcessesResult)) {
    throw Result.unwrapError(runningProcessesResult);
  }

  const runningProcesses = Result.unwrap(runningProcessesResult);

  if (runningProcesses.length > 0) {
    throw new Error(
      `Ultra RSS Reader appears to be running (${runningProcesses.join(", ")}). Close the app before replacing the Dev database.`,
    );
  }

  const dirs = resolveSeedAppDataDirs(options);
  const plan = buildSeedPlan(dirs);
  const openHandlesResult = await detectOpenDevDatabaseHandles({
    platform,
    artifactPaths: plan.artifacts.map((artifact) => artifact.destination),
    execFileImpl: options.execFileImpl,
  });
  if (Result.isFailure(openHandlesResult)) {
    throw Result.unwrapError(openHandlesResult);
  }

  const openHandles = Result.unwrap(openHandlesResult);
  if (openHandles.length > 0) {
    throw new Error(`Dev database appears to be open (${openHandles.join(", ")}). Close the app before replacing it.`);
  }

  return seedDevDatabaseFromProdPlan(plan);
}

async function main(): Promise<void> {
  const result = await seedDevDatabaseFromProd();
  console.info("[seed-from-prod] Dev database has been seeded from the packaged app data.");
  console.info(`[seed-from-prod] Backed up existing Dev artifacts to: ${result.backupDir}`);
  console.info(
    "[seed-from-prod] Credentials were not copied. Use `mise run app:dev:native-keyring` for production-like credentials.",
  );
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error("[seed-from-prod]", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
