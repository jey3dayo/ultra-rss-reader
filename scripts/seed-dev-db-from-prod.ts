import { execFile } from "node:child_process";
import type { Stats } from "node:fs";
import { constants as fsConstants } from "node:fs";
import { access, copyFile, lstat, mkdir, rm } from "node:fs/promises";
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
type BeforeReplaceImpl = () => Promise<void>;
type SymlinkStats = Pick<Stats, "isSymbolicLink">;
type LstatImpl = (targetPath: string) => Promise<SymlinkStats>;

type SeedArtifact = {
  source: string;
  destination: string;
  backup: string;
  staging: string;
  suffix: string;
};

type SeedPlan = {
  prodAppDataDir: string;
  devAppDataDir: string;
  backupDir: string;
  stagingDir: string;
  artifacts: SeedArtifact[];
};

const PROD_APP_IDENTIFIER = "com.jey3dayo.ultra-rss-reader";
const DEV_APP_IDENTIFIER = "com.ultra-rss-reader.dev";
const DEV_APP_DATA_MARKER_FILE_NAME = ".ultra-rss-reader-dev-app-data";
const DATABASE_FILE_NAME = "ultra-rss-reader.db";
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

function databaseHandleDetectionError(error: unknown, artifactPath: string): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to check whether the Dev database is open for ${artifactPath}: ${detail}`);
}

function readConfiguredEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  return value !== undefined && value.trim().length > 0 ? value : undefined;
}

function resolveAppDataDir(options: {
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

function buildDatabaseArtifactPaths(appDataDir: string): string[] {
  return DATABASE_SUFFIXES.map((suffix) => path.join(appDataDir, `${DATABASE_FILE_NAME}${suffix}`));
}

function resolveBackupDirName(timestamp: string): string {
  return `seed-from-prod-${timestamp}`;
}

function resolveDevAppDataMarkerPath(appDataDir: string): string {
  return path.join(appDataDir, DEV_APP_DATA_MARKER_FILE_NAME);
}

function buildSeedPlan(options: { prodAppDataDir: string; devAppDataDir: string; timestamp?: string }): SeedPlan {
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

function resolveSeedAppDataDirs(options: { env?: NodeJS.ProcessEnv; platform?: SeedPlatform; homeDir?: string } = {}): {
  prodAppDataDir: string;
  devAppDataDir: string;
} {
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

async function listLikelyRunningAppProcesses(
  options: { platform?: SeedPlatform; execFileImpl?: ExecFileAsync } = {},
): Promise<string[]> {
  const result = await detectLikelyRunningAppProcesses(options);
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }

  return Result.unwrap(result);
}

async function detectLikelyRunningAppProcesses(
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
          .map((line) => parseTasklistCsvLine(line)[0]?.trim() ?? "")
          .filter(isLikelyWindowsAppProcessName),
      );
    } catch (error) {
      return Result.fail(processDetectionError(error));
    }
  }

  return Result.succeed([]);
}

function parseTasklistCsvLine(line: string): string[] {
  const columns: string[] = [];
  let currentColumn = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentColumn += character;
      index += 1;
      continue;
    }

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === "," && !isQuoted) {
      columns.push(currentColumn);
      currentColumn = "";
      continue;
    }

    currentColumn += character;
  }

  if (line.length > 0 || currentColumn.length > 0) {
    columns.push(currentColumn);
  }

  return columns;
}

function isLikelyWindowsAppProcessName(processName: string): boolean {
  return /^(?:Ultra RSS Reader(?: Dev)?|ultra-rss-reader)\.exe$/i.test(processName);
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
    const { stdout } = await execFileImpl("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
    });
    if (hasLikelyUnixAppCommandLine(stdout, processName)) {
      return { processName, error: null };
    }

    const notFoundError = new Error("not found") as NodeJS.ErrnoException;
    notFoundError.code = "1";
    return { processName, error: notFoundError };
  } catch (fullCommandLineError) {
    return { processName, error: fullCommandLineError };
  }
}

function hasLikelyUnixAppCommandLine(stdout: string, processName: string): boolean {
  const likelyExecutablePathFragments =
    processName === "Ultra RSS Reader"
      ? [
          "/Ultra RSS Reader/Ultra RSS Reader",
          "/Ultra RSS Reader/ultra-rss-reader",
          "/Ultra RSS Reader.app/Contents/MacOS/Ultra RSS Reader",
          "\\Ultra RSS Reader\\Ultra RSS Reader",
          "\\Ultra RSS Reader\\ultra-rss-reader",
          "\\Ultra RSS Reader.app\\Contents\\MacOS\\Ultra RSS Reader",
        ]
      : processName === "Ultra RSS Reader Dev"
        ? [
            "/Ultra RSS Reader Dev/Ultra RSS Reader Dev",
            "/Ultra RSS Reader Dev/ultra-rss-reader",
            "/Ultra RSS Reader Dev.app/Contents/MacOS/Ultra RSS Reader Dev",
            "\\Ultra RSS Reader Dev\\Ultra RSS Reader Dev",
            "\\Ultra RSS Reader Dev\\ultra-rss-reader",
            "\\Ultra RSS Reader Dev.app\\Contents\\MacOS\\Ultra RSS Reader Dev",
          ]
        : ["/ultra-rss-reader", "\\ultra-rss-reader"];

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => {
      const commandLine = line.replace(/^\d+\s+/, "");
      return likelyExecutablePathFragments.some((fragment) => hasExecutablePathFragment(commandLine, fragment));
    });
}

function hasExecutablePathFragment(commandLine: string, fragment: string): boolean {
  const fragmentIndex = commandLine.indexOf(fragment);
  if (fragmentIndex < 0 || /\s/.test(commandLine.slice(0, fragmentIndex))) {
    return false;
  }

  const nextCharacter = commandLine[fragmentIndex + fragment.length];
  if (nextCharacter === undefined) {
    return true;
  }

  if (!/\s/.test(nextCharacter)) {
    return false;
  }

  const trailingCommandLine = commandLine.slice(fragmentIndex + fragment.length).trimStart();
  return trailingCommandLine.length === 0 || trailingCommandLine.startsWith("-") || trailingCommandLine.startsWith("(");
}

function isProcessNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error.code === 1 || error.code === "1");
}

async function detectOpenDevDatabaseHandles(options: {
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
      return Result.fail(databaseHandleDetectionError(check.error, check.artifactPath));
    }
  }

  return Result.succeed(
    checks.flatMap((check) => (check.error === null && check.stdout.trim().length > 0 ? [check.artifactPath] : [])),
  );
}

async function assertSafeDevTarget(plan: SeedPlan, accessImpl: AccessImpl): Promise<void> {
  const prodBaseName = path.basename(path.resolve(plan.prodAppDataDir));
  const devBaseName = path.basename(path.resolve(plan.devAppDataDir));
  const backupBaseDir = path.resolve(plan.devAppDataDir, "backups");
  const backupDir = path.resolve(plan.backupDir);
  const stagingDir = path.resolve(plan.stagingDir);

  if (prodBaseName === DEV_APP_IDENTIFIER) {
    throw new Error("Refusing to seed from a Dev app data directory.");
  }

  if (devBaseName === PROD_APP_IDENTIFIER) {
    throw new Error("Refusing to seed a non-Dev app data directory.");
  }

  if (
    devBaseName !== DEV_APP_IDENTIFIER &&
    devBaseName !== "dev" &&
    !(await fileExists(resolveDevAppDataMarkerPath(plan.devAppDataDir), accessImpl))
  ) {
    throw new Error(
      `Refusing to seed an unmarked Dev app data directory. Create ${DEV_APP_DATA_MARKER_FILE_NAME} in the target directory to allow this override.`,
    );
  }

  if (plan.artifacts.some((artifact) => artifact.destination === artifact.source)) {
    throw new Error("Refusing to seed when source and destination artifacts overlap.");
  }

  if (path.dirname(backupDir) !== backupBaseDir) {
    throw new Error("Refusing to write backups outside the Dev backup directory.");
  }

  if (path.dirname(stagingDir) !== backupBaseDir) {
    throw new Error("Refusing to stage artifacts outside the Dev backup directory.");
  }

  for (const artifact of plan.artifacts) {
    if (path.dirname(path.resolve(artifact.source)) !== path.resolve(plan.prodAppDataDir)) {
      throw new Error("Refusing to seed from an artifact outside the production app data directory.");
    }

    if (path.dirname(path.resolve(artifact.destination)) !== path.resolve(plan.devAppDataDir)) {
      throw new Error("Refusing to clean up an artifact outside the Dev app data directory.");
    }

    if (path.dirname(path.resolve(artifact.backup)) !== backupDir) {
      throw new Error("Refusing to write a backup artifact outside the selected backup directory.");
    }

    if (path.dirname(path.resolve(artifact.staging)) !== stagingDir) {
      throw new Error("Refusing to write a staging artifact outside the selected staging directory.");
    }

    if (!artifact.source.endsWith(`${DATABASE_FILE_NAME}${artifact.suffix}`)) {
      throw new Error("Refusing to copy a non-database source artifact.");
    }

    if (!artifact.destination.endsWith(`${DATABASE_FILE_NAME}${artifact.suffix}`)) {
      throw new Error("Refusing to replace a non-database Dev artifact.");
    }

    if (!artifact.backup.endsWith(`${DATABASE_FILE_NAME}${artifact.suffix}`)) {
      throw new Error("Refusing to back up a non-database Dev artifact.");
    }

    if (!artifact.staging.endsWith(`${DATABASE_FILE_NAME}${artifact.suffix}`)) {
      throw new Error("Refusing to stage a non-database source artifact.");
    }
  }
}

async function assertNotSymlink(targetPath: string, accessImpl: AccessImpl, lstatImpl: LstatImpl): Promise<void> {
  if (!(await fileExists(targetPath, accessImpl))) {
    return;
  }

  let stats: SymlinkStats;
  try {
    stats = await lstatImpl(targetPath);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return;
    }
    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Refusing to seed through a symlink: ${targetPath}`);
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function seedDevDatabaseFromProdPlan(
  plan: SeedPlan,
  options: {
    accessImpl?: AccessImpl;
    beforeReplaceImpl?: BeforeReplaceImpl;
    copyFileImpl?: CopyFileImpl;
    lstatImpl?: LstatImpl;
    mkdirImpl?: MkdirImpl;
    rmImpl?: RmImpl;
  } = {},
): Promise<{ copied: string[]; backedUp: string[]; backupDir: string }> {
  const accessImpl = options.accessImpl ?? access;
  const beforeReplaceImpl = options.beforeReplaceImpl ?? (async () => {});
  const copyFileImpl = options.copyFileImpl ?? copyFile;
  const lstatImpl = options.lstatImpl ?? lstat;
  const mkdirImpl = options.mkdirImpl ?? mkdir;
  const rmImpl = options.rmImpl ?? rm;
  const mainArtifact = plan.artifacts[0];

  if (!mainArtifact) {
    throw new Error("No database artifacts are configured.");
  }

  if (path.resolve(plan.prodAppDataDir) === path.resolve(plan.devAppDataDir)) {
    throw new Error("Production and Dev app data directories resolve to the same path.");
  }

  await assertSafeDevTarget(plan, accessImpl);

  await assertNotSymlink(plan.prodAppDataDir, accessImpl, lstatImpl);
  await assertNotSymlink(plan.devAppDataDir, accessImpl, lstatImpl);
  await assertNotSymlink(plan.backupDir, accessImpl, lstatImpl);
  await assertNotSymlink(plan.stagingDir, accessImpl, lstatImpl);

  if (await fileExists(plan.backupDir, accessImpl)) {
    throw new Error(`Backup directory already exists, refusing to overwrite it: ${plan.backupDir}`);
  }

  const sourceArtifacts = (
    await Promise.all(
      plan.artifacts.map(async (artifact) => {
        if (!(await fileExists(artifact.source, accessImpl))) {
          return null;
        }
        await assertNotSymlink(artifact.source, accessImpl, lstatImpl);
        await accessImpl(artifact.source, fsConstants.R_OK);
        return artifact;
      }),
    )
  ).filter((artifact): artifact is SeedArtifact => artifact !== null);

  if (!sourceArtifacts.includes(mainArtifact)) {
    await accessImpl(mainArtifact.source, fsConstants.R_OK);
  }

  await rmImpl(plan.stagingDir, { recursive: true, force: true });
  await mkdirImpl(plan.stagingDir, { recursive: true });

  let primaryError: unknown;

  try {
    await Promise.all(sourceArtifacts.map((artifact) => copyFileImpl(artifact.source, artifact.staging)));

    // Keep replacement phases ordered: staging copy, backup, destination cleanup, then install.
    await mkdirImpl(plan.backupDir, { recursive: true });
    const backedUpArtifacts = (
      await Promise.all(
        plan.artifacts.map(async (artifact) => {
          if (!(await fileExists(artifact.destination, accessImpl))) {
            return null;
          }

          await assertNotSymlink(artifact.destination, accessImpl, lstatImpl);
          await assertNotSymlink(artifact.backup, accessImpl, lstatImpl);
          await accessImpl(artifact.destination, fsConstants.R_OK);
          await copyFileImpl(artifact.destination, artifact.backup);
          return artifact;
        }),
      )
    ).filter((artifact): artifact is SeedArtifact => artifact !== null);

    await beforeReplaceImpl();

    await mkdirImpl(plan.devAppDataDir, { recursive: true });
    await Promise.all(plan.artifacts.map((artifact) => rmImpl(artifact.destination, { force: true })));

    try {
      await Promise.all(sourceArtifacts.map((artifact) => copyFileImpl(artifact.staging, artifact.destination)));
    } catch (error) {
      await Promise.all(backedUpArtifacts.map((artifact) => copyFileImpl(artifact.backup, artifact.destination)));
      throw error;
    }

    return {
      copied: sourceArtifacts.map((artifact) => artifact.destination),
      backedUp: backedUpArtifacts.map((artifact) => artifact.destination),
      backupDir: plan.backupDir,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (primaryError !== undefined) {
      await rmImpl(plan.stagingDir, { recursive: true, force: true }).catch(() => undefined);
    } else {
      await rmImpl(plan.stagingDir, { recursive: true, force: true });
    }
  }
}

export async function seedDevDatabaseFromProd(
  options: { env?: NodeJS.ProcessEnv; platform?: SeedPlatform; homeDir?: string; execFileImpl?: ExecFileAsync } = {},
): Promise<{ copied: string[]; backedUp: string[]; backupDir: string }> {
  const platform = options.platform ?? process.platform;
  const dirs = resolveSeedAppDataDirs(options);
  const plan = buildSeedPlan(dirs);
  const artifactPaths = plan.artifacts.map((artifact) => artifact.destination);
  const guardOptions = {
    platform,
    artifactPaths,
    execFileImpl: options.execFileImpl,
  };

  await assertDevDatabaseSafeToReplace(guardOptions);

  return seedDevDatabaseFromProdPlan(plan, {
    beforeReplaceImpl: () => assertDevDatabaseSafeToReplace(guardOptions),
  });
}

async function assertDevDatabaseSafeToReplace(options: {
  platform: SeedPlatform;
  artifactPaths: readonly string[];
  execFileImpl?: ExecFileAsync;
}): Promise<void> {
  const [runningProcessesResult, openHandlesResult] = await Promise.all([
    detectLikelyRunningAppProcesses({
      platform: options.platform,
      execFileImpl: options.execFileImpl,
    }),
    detectOpenDevDatabaseHandles({
      platform: options.platform,
      artifactPaths: options.artifactPaths,
      execFileImpl: options.execFileImpl,
    }),
  ]);

  if (Result.isFailure(runningProcessesResult)) {
    throw Result.unwrapError(runningProcessesResult);
  }

  const runningProcesses = Result.unwrap(runningProcessesResult);

  if (runningProcesses.length > 0) {
    throw new Error(
      `Ultra RSS Reader appears to be running (${runningProcesses.join(", ")}). Close the app before replacing the Dev database.`,
    );
  }

  if (Result.isFailure(openHandlesResult)) {
    throw Result.unwrapError(openHandlesResult);
  }

  const openHandles = Result.unwrap(openHandlesResult);
  if (openHandles.length > 0) {
    throw new Error(`Dev database appears to be open (${openHandles.join(", ")}). Close the app before replacing it.`);
  }
}

export const seedDevDatabaseFromProdTestBoundary = {
  buildDatabaseArtifactPaths,
  buildSeedPlan,
  detectLikelyRunningAppProcesses,
  detectOpenDevDatabaseHandles,
  listLikelyRunningAppProcesses,
  resolveAppDataDir,
  resolveBackupDirName,
  resolveSeedAppDataDirs,
  seedDevDatabaseFromProdPlan,
};

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
