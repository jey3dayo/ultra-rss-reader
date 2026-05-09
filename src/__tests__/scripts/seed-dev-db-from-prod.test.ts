import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  buildDatabaseArtifactPaths,
  buildSeedPlan,
  detectLikelyRunningAppProcesses,
  detectOpenDevDatabaseHandles,
  resolveAppDataDir,
  resolveBackupDirName,
  resolveSeedAppDataDirs,
  seedDevDatabaseFromProd,
  seedDevDatabaseFromProdPlan,
} from "../../../scripts/seed-dev-db-from-prod.ts";

// Windows CI returns backslashes from node:path; keep path assertions and suffix checks portable.
function toPortablePath(value: string) {
  return value.replaceAll("\\", "/");
}

function hasPortablePathSuffix(value: string, suffix: string) {
  return toPortablePath(value).endsWith(suffix);
}

describe("resolveAppDataDir", () => {
  it("resolves macOS Tauri app data directories from bundle identifiers", () => {
    expect(
      toPortablePath(
        resolveAppDataDir({
          platform: "darwin",
          homeDir: "/Users/alice",
          env: {},
          identifier: "com.jey3dayo.ultra-rss-reader",
        }),
      ),
    ).toBe("/Users/alice/Library/Application Support/com.jey3dayo.ultra-rss-reader");
  });

  it("resolves Windows Tauri app data directories from APPDATA", () => {
    expect(
      toPortablePath(
        resolveAppDataDir({
          platform: "win32",
          homeDir: "C:\\Users\\alice",
          env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" },
          identifier: "com.ultra-rss-reader.dev",
        }),
      ),
    ).toBe("C:/Users/alice/AppData/Roaming/com.ultra-rss-reader.dev");
  });

  it("falls back to Windows roaming app data when APPDATA is blank", () => {
    expect(
      toPortablePath(
        resolveAppDataDir({
          platform: "win32",
          homeDir: "C:\\Users\\alice",
          env: { APPDATA: "  " },
          identifier: "com.ultra-rss-reader.dev",
        }),
      ),
    ).toBe("C:/Users/alice/AppData/Roaming/com.ultra-rss-reader.dev");
  });

  it("falls back to Linux data home when XDG_DATA_HOME is blank", () => {
    expect(
      toPortablePath(
        resolveAppDataDir({
          platform: "linux",
          homeDir: "/home/alice",
          env: { XDG_DATA_HOME: "" },
          identifier: "com.ultra-rss-reader.dev",
        }),
      ),
    ).toBe("/home/alice/.local/share/com.ultra-rss-reader.dev");
  });
});

describe("resolveSeedAppDataDirs", () => {
  it("falls back to platform app data directories when override env values are blank", () => {
    expect(
      Object.fromEntries(
        Object.entries(
          resolveSeedAppDataDirs({
            platform: "linux",
            homeDir: "/home/alice",
            env: {
              ULTRA_RSS_PROD_APP_DATA_DIR: "",
              ULTRA_RSS_DEV_APP_DATA_DIR: "  ",
              XDG_DATA_HOME: "/home/alice/.local/state",
            },
          }),
        ).map(([key, value]) => [key, toPortablePath(value)]),
      ),
    ).toEqual({
      prodAppDataDir: "/home/alice/.local/state/com.jey3dayo.ultra-rss-reader",
      devAppDataDir: "/home/alice/.local/state/com.ultra-rss-reader.dev",
    });
  });
});

describe("buildDatabaseArtifactPaths", () => {
  it("targets the SQLite database plus WAL and SHM artifacts", () => {
    expect(buildDatabaseArtifactPaths("/app-data").map(toPortablePath)).toEqual([
      "/app-data/ultra-rss-reader.db",
      "/app-data/ultra-rss-reader.db-wal",
      "/app-data/ultra-rss-reader.db-shm",
    ]);
  });
});

describe("buildSeedPlan", () => {
  it("plans source, destination, backup, and staging paths without credentials", () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/dev",
      timestamp: "20260501T123456",
    });

    expect(toPortablePath(plan.backupDir)).toBe("/dev/backups/seed-from-prod-20260501T123456");
    expect(toPortablePath(plan.stagingDir)).toBe("/dev/backups/seed-from-prod-20260501T123456.staging");
    expect(plan.artifacts.map((artifact) => artifact.suffix)).toEqual(["", "-wal", "-shm"]);
    expect(plan.artifacts.map((artifact) => toPortablePath(artifact.source))).toEqual([
      "/prod/ultra-rss-reader.db",
      "/prod/ultra-rss-reader.db-wal",
      "/prod/ultra-rss-reader.db-shm",
    ]);
    expect(plan.artifacts.map((artifact) => toPortablePath(artifact.destination))).toEqual([
      "/dev/ultra-rss-reader.db",
      "/dev/ultra-rss-reader.db-wal",
      "/dev/ultra-rss-reader.db-shm",
    ]);
  });

  it("uses timestamped backup directory names", () => {
    expect(resolveBackupDirName("20260501T123456")).toBe("seed-from-prod-20260501T123456");
  });
});

describe("seedDevDatabaseFromProdPlan", () => {
  it("rejects a Dev target that points at the packaged app data directory", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/Users/alice/Library/Application Support/com.jey3dayo.ultra-rss-reader",
      timestamp: "20260501T123456",
    });

    await expect(seedDevDatabaseFromProdPlan(plan)).rejects.toThrow("Refusing to seed a non-Dev app data directory");
  });

  it("does not change the Dev database when the production database is missing", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await mkdir(devDir, { recursive: true });
      await writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db");

      await expect(
        seedDevDatabaseFromProdPlan(
          buildSeedPlan({
            prodAppDataDir: prodDir,
            devAppDataDir: devDir,
            timestamp: "20260501T123456",
          }),
        ),
      ).rejects.toThrow();

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not replace the Dev database when backup copy fails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await mkdir(prodDir, { recursive: true });
      await mkdir(devDir, { recursive: true });
      await writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db");
      await writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db");

      await expect(
        seedDevDatabaseFromProdPlan(
          buildSeedPlan({
            prodAppDataDir: prodDir,
            devAppDataDir: devDir,
            timestamp: "20260501T123456",
          }),
          {
            copyFileImpl: async (source, destination) => {
              if (
                hasPortablePathSuffix(String(destination), "backups/seed-from-prod-20260501T123456/ultra-rss-reader.db")
              ) {
                throw new Error("backup failed");
              }
              await copyFile(source, destination);
            },
          },
        ),
      ).rejects.toThrow("backup failed");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
      await expect(
        readFile(path.join(devDir, "backups", "seed-from-prod-20260501T123456.staging", "ultra-rss-reader.db")),
      ).rejects.toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("checks source artifacts concurrently while preserving copy result order", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/dev",
      timestamp: "20260501T123456",
    });
    const accessRequests: string[] = [];
    const accessCounts = new Map<string, number>();
    const releaseArtifactChecks = new Map<string, () => void>();

    const resultPromise = seedDevDatabaseFromProdPlan(plan, {
      accessImpl: async (targetPath) => {
        const pathText = toPortablePath(String(targetPath));
        accessRequests.push(pathText);
        const accessCount = (accessCounts.get(pathText) ?? 0) + 1;
        accessCounts.set(pathText, accessCount);
        if (pathText.startsWith("/prod/") && accessCount > 1 && !releaseArtifactChecks.has(pathText)) {
          await new Promise<void>((resolve) => {
            releaseArtifactChecks.set(pathText, resolve);
          });
        }
      },
      copyFileImpl: async () => {},
      mkdirImpl: async () => {},
      rmImpl: async () => {},
    });

    for (let index = 0; index < 10 && releaseArtifactChecks.size < 3; index += 1) {
      await Promise.resolve();
    }
    expect(releaseArtifactChecks.size).toBe(3);
    expect(accessRequests).toEqual(
      expect.arrayContaining([
        "/prod/ultra-rss-reader.db",
        "/prod/ultra-rss-reader.db-wal",
        "/prod/ultra-rss-reader.db-shm",
      ]),
    );
    expect(accessRequests.filter((request) => request.startsWith("/dev/"))).toEqual([]);

    for (const releaseCheck of releaseArtifactChecks.values()) {
      releaseCheck();
    }

    await expect(resultPromise).resolves.toMatchObject({
      copied: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
      backedUp: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
    });
  });
});

describe("seedDevDatabaseFromProd", () => {
  it("checks Unix app process names concurrently while preserving result order", async () => {
    const requestedProcessNames: string[] = [];
    const releaseChecks = new Map<string, () => void>();

    const detectionPromise = detectLikelyRunningAppProcesses({
      platform: "darwin",
      execFileImpl: async (_command, args) => {
        const processName = args[1];
        requestedProcessNames.push(processName);
        await new Promise<void>((resolve) => {
          releaseChecks.set(processName, resolve);
        });
        return { stdout: "", stderr: "" };
      },
    });

    await Promise.resolve();
    expect(requestedProcessNames).toEqual(["Ultra RSS Reader", "Ultra RSS Reader Dev", "ultra-rss-reader"]);

    for (const releaseCheck of releaseChecks.values()) {
      releaseCheck();
    }

    expect(Result.unwrap(await detectionPromise)).toEqual([
      "Ultra RSS Reader",
      "Ultra RSS Reader Dev",
      "ultra-rss-reader",
    ]);
  });

  it("detects open Dev database handles on Unix-like platforms", async () => {
    const result = await detectOpenDevDatabaseHandles({
      platform: "darwin",
      artifactPaths: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal"],
      execFileImpl: async (_command, args) => ({
        stdout: args.join("\n"),
        stderr: "",
      }),
    });

    expect(Result.unwrap(result)).toEqual(["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal"]);
  });

  it("does not replace the Dev database when a database handle is open", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await mkdir(prodDir, { recursive: true });
      await mkdir(devDir, { recursive: true });
      await writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db");
      await writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db");

      await expect(
        seedDevDatabaseFromProd({
          env: {
            ULTRA_RSS_PROD_APP_DATA_DIR: prodDir,
            ULTRA_RSS_DEV_APP_DATA_DIR: devDir,
          },
          platform: "darwin",
          execFileImpl: async (command, args) => {
            if (command === "pgrep") {
              const error = new Error("not found") as NodeJS.ErrnoException;
              error.code = "1";
              throw error;
            }
            if (command === "lsof") {
              return { stdout: String(args[args.length - 1]), stderr: "" };
            }
            throw new Error(`unexpected command: ${command}`);
          },
        }),
      ).rejects.toThrow("Dev database appears to be open");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns a failure result when Windows process detection fails", async () => {
    const result = await detectLikelyRunningAppProcesses({
      platform: "win32",
      execFileImpl: async () => {
        throw new Error("tasklist unavailable");
      },
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("Failed to check whether Ultra RSS Reader is running");
  });

  it("does not replace the Dev database when Windows process detection fails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await mkdir(prodDir, { recursive: true });
      await mkdir(devDir, { recursive: true });
      await writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db");
      await writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db");

      await expect(
        seedDevDatabaseFromProd({
          env: {
            ULTRA_RSS_PROD_APP_DATA_DIR: prodDir,
            ULTRA_RSS_DEV_APP_DATA_DIR: devDir,
          },
          platform: "win32",
          execFileImpl: async () => {
            throw new Error("tasklist unavailable");
          },
        }),
      ).rejects.toThrow("Failed to check whether Ultra RSS Reader is running");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
