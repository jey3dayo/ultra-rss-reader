import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  seedDevDatabaseFromProd,
  seedDevDatabaseFromProdTestBoundary,
} from "../../../scripts/seed-dev-db-from-prod.ts";

const {
  buildDatabaseArtifactPaths,
  buildSeedPlan,
  detectLikelyRunningAppProcesses,
  detectOpenDevDatabaseHandles,
  resolveAppDataDir,
  resolveBackupDirName,
  resolveSeedAppDataDirs,
  seedDevDatabaseFromProdPlan,
} = seedDevDatabaseFromProdTestBoundary;

// Windows CI returns backslashes from node:path; keep path assertions and suffix checks portable.
function toPortablePath(value: string) {
  return value.replaceAll("\\", "/");
}

function hasPortablePathSuffix(value: string, suffix: string) {
  return toPortablePath(value).endsWith(suffix);
}

function createNonSymlinkStats(): { isSymbolicLink: () => boolean } {
  return { isSymbolicLink: () => false };
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

  it("rejects a source target that points at the Dev app data directory", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/Users/alice/Library/Application Support/com.ultra-rss-reader.dev",
      devAppDataDir: "/Users/alice/Library/Application Support/com.jey3dayo.ultra-rss-reader.dev",
      timestamp: "20260501T123456",
    });

    await expect(seedDevDatabaseFromProdPlan(plan)).rejects.toThrow("Refusing to seed from a Dev app data directory");
  });

  it("rejects artifact destinations outside the Dev app data directory before cleanup", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/dev",
      timestamp: "20260501T123456",
    });
    const unsafePlan = {
      ...plan,
      artifacts: plan.artifacts.map((artifact, index) =>
        index === 0 ? { ...artifact, destination: "/other/ultra-rss-reader.db" } : artifact,
      ),
    };

    await expect(
      seedDevDatabaseFromProdPlan(unsafePlan, {
        accessImpl: async () => {},
        copyFileImpl: async () => {},
        lstatImpl: async () => {
          throw new Error("lstat should not run for an invalid plan");
        },
        mkdirImpl: async () => {},
        rmImpl: async () => {
          throw new Error("rm should not run for an invalid plan");
        },
      }),
    ).rejects.toThrow("Refusing to clean up an artifact outside the Dev app data directory");
  });

  it("rejects non-database artifacts so credentials are not copied", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/dev",
      timestamp: "20260501T123456",
    });
    const unsafePlan = {
      ...plan,
      artifacts: [
        ...plan.artifacts,
        {
          suffix: "",
          source: "/prod/credentials.json",
          destination: "/dev/credentials.json",
          backup: "/dev/backups/seed-from-prod-20260501T123456/credentials.json",
          staging: "/dev/backups/seed-from-prod-20260501T123456.staging/credentials.json",
        },
      ],
    };

    await expect(
      seedDevDatabaseFromProdPlan(unsafePlan, {
        accessImpl: async () => {},
        copyFileImpl: async () => {},
        mkdirImpl: async () => {},
        rmImpl: async () => {},
      }),
    ).rejects.toThrow("Refusing to copy a non-database source artifact");
  });

  it("rejects symlinked source database artifacts", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      const realProdDbPath = path.join(tempDir, "real-prod.db");
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await writeFile(realProdDbPath, "prod-db");
      await Promise.all([
        symlink(realProdDbPath, path.join(prodDir, "ultra-rss-reader.db")),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

      await expect(
        seedDevDatabaseFromProdPlan(
          buildSeedPlan({
            prodAppDataDir: prodDir,
            devAppDataDir: devDir,
            timestamp: "20260501T123456",
          }),
        ),
      ).rejects.toThrow("Refusing to seed through a symlink");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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
    const rmRequests: string[] = [];
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db"),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

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
            rmImpl: async (targetPath, options) => {
              rmRequests.push(toPortablePath(String(targetPath)));
              await rm(targetPath, options);
            },
          },
        ),
      ).rejects.toThrow("backup failed");

      expect(rmRequests).not.toContain(toPortablePath(path.join(devDir, "ultra-rss-reader.db")));
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

    const resultPromise = seedDevDatabaseFromProdPlan(plan, {
      accessImpl: async (targetPath) => {
        const pathText = toPortablePath(String(targetPath));
        accessRequests.push(pathText);
      },
      lstatImpl: async () => createNonSymlinkStats(),
      copyFileImpl: async () => {},
      mkdirImpl: async () => {},
      rmImpl: async () => {},
    });

    await expect(resultPromise).resolves.toMatchObject({
      copied: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
      backedUp: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
    });

    expect(accessRequests).toEqual(
      expect.arrayContaining([
        "/prod/ultra-rss-reader.db",
        "/prod/ultra-rss-reader.db-wal",
        "/prod/ultra-rss-reader.db-shm",
      ]),
    );
    expect(accessRequests.filter((request) => request.startsWith("/dev/"))).toEqual(
      expect.arrayContaining([
        "/dev/ultra-rss-reader.db",
        "/dev/ultra-rss-reader.db-wal",
        "/dev/ultra-rss-reader.db-shm",
      ]),
    );
  });

  it("backs up existing Dev artifacts concurrently before destination cleanup", async () => {
    const plan = buildSeedPlan({
      prodAppDataDir: "/prod",
      devAppDataDir: "/dev",
      timestamp: "20260501T123456",
    });
    const copyRequests: string[] = [];
    const rmRequests: string[] = [];
    const releaseBackupCopies = new Map<string, () => void>();

    const resultPromise = seedDevDatabaseFromProdPlan(plan, {
      accessImpl: async () => {},
      copyFileImpl: async (source, destination) => {
        const sourcePath = toPortablePath(String(source));
        const destinationPath = toPortablePath(String(destination));
        copyRequests.push(`${sourcePath}->${destinationPath}`);
        if (sourcePath.startsWith("/dev/") && destinationPath.includes("/backups/seed-from-prod-20260501T123456/")) {
          await new Promise<void>((resolve) => {
            releaseBackupCopies.set(destinationPath, resolve);
          });
        }
      },
      mkdirImpl: async () => {},
      rmImpl: async (targetPath) => {
        rmRequests.push(toPortablePath(String(targetPath)));
      },
    });

    // Polling is intentionally sequential: each tick gives the in-flight copy hooks a chance to register.
    for (let index = 0; index < 10 && releaseBackupCopies.size < 3; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(releaseBackupCopies.size).toBe(3);
    expect(rmRequests).toEqual(["/dev/backups/seed-from-prod-20260501T123456.staging"]);

    for (const releaseBackupCopy of releaseBackupCopies.values()) {
      releaseBackupCopy();
    }

    await expect(resultPromise).resolves.toMatchObject({
      backedUp: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
    });
    expect(copyRequests).toEqual(
      expect.arrayContaining([
        "/prod/ultra-rss-reader.db->/dev/backups/seed-from-prod-20260501T123456.staging/ultra-rss-reader.db",
        "/dev/ultra-rss-reader.db->/dev/backups/seed-from-prod-20260501T123456/ultra-rss-reader.db",
        "/dev/backups/seed-from-prod-20260501T123456.staging/ultra-rss-reader.db->/dev/ultra-rss-reader.db",
      ]),
    );
    expect(rmRequests).toEqual([
      "/dev/backups/seed-from-prod-20260501T123456.staging",
      "/dev/ultra-rss-reader.db",
      "/dev/ultra-rss-reader.db-wal",
      "/dev/ultra-rss-reader.db-shm",
      "/dev/backups/seed-from-prod-20260501T123456.staging",
    ]);
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

  it("detects long Unix app process names from full command lines when exact name checks miss", async () => {
    const result = await detectLikelyRunningAppProcesses({
      platform: "linux",
      execFileImpl: async (_command, args) => {
        const mode = args[0];
        const processName = args[1];
        if (mode === "-f" && processName === "Ultra RSS Reader Dev") {
          return {
            stdout: "123 /opt/Ultra RSS Reader Dev/ultra-rss-reader\n",
            stderr: "",
          };
        }
        const error = new Error("not found") as NodeJS.ErrnoException;
        error.code = "1";
        throw error;
      },
    });

    expect(Result.unwrap(result)).toEqual(["Ultra RSS Reader Dev"]);
  });

  it("does not replace the Dev database when the Unix full command line guard detects a running app", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db"),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

      await expect(
        seedDevDatabaseFromProd({
          env: {
            ULTRA_RSS_PROD_APP_DATA_DIR: prodDir,
            ULTRA_RSS_DEV_APP_DATA_DIR: devDir,
          },
          platform: "linux",
          execFileImpl: async (_command, args) => {
            const mode = args[0];
            const processName = args[1];
            if (mode === "-f" && processName === "Ultra RSS Reader Dev") {
              return {
                stdout: "123 /opt/Ultra RSS Reader Dev/ultra-rss-reader\n",
                stderr: "",
              };
            }
            const error = new Error("not found") as NodeJS.ErrnoException;
            error.code = "1";
            throw error;
          },
        }),
      ).rejects.toThrow("Ultra RSS Reader appears to be running");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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

  it("reports which database artifact could not be checked when lsof is unavailable", async () => {
    const result = await detectOpenDevDatabaseHandles({
      platform: "darwin",
      artifactPaths: ["/dev/ultra-rss-reader.db"],
      execFileImpl: async () => {
        const error = new Error("spawn lsof ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("/dev/ultra-rss-reader.db");
    expect(Result.unwrapError(result).message).toContain("spawn lsof ENOENT");
  });

  it("reports the WAL path when only the WAL artifact is open", async () => {
    const result = await detectOpenDevDatabaseHandles({
      platform: "linux",
      artifactPaths: ["/dev/ultra-rss-reader.db", "/dev/ultra-rss-reader.db-wal", "/dev/ultra-rss-reader.db-shm"],
      execFileImpl: async (_command, args) => {
        const artifactPath = String(args[args.length - 1]);
        if (artifactPath.endsWith("-wal")) {
          return { stdout: "4242\n", stderr: "" };
        }
        const error = new Error("not found") as NodeJS.ErrnoException;
        error.code = "1";
        throw error;
      },
    });

    expect(Result.unwrap(result)).toEqual(["/dev/ultra-rss-reader.db-wal"]);
  });

  it("does not replace the Dev database when a database handle is open", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db"),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

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

  it("checks app processes and database handles concurrently before seeding", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ultra-rss-seed-test-"));
    try {
      const prodDir = path.join(tempDir, "prod");
      const devDir = path.join(tempDir, "dev");
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db"),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

      const pendingCommands = new Set<string>();
      const releaseCommands = new Map<string, () => void>();

      const resultPromise = seedDevDatabaseFromProd({
        env: {
          ULTRA_RSS_PROD_APP_DATA_DIR: prodDir,
          ULTRA_RSS_DEV_APP_DATA_DIR: devDir,
        },
        platform: "darwin",
        execFileImpl: async (command, args) => {
          const key = `${command}:${String(args[0])}:${String(args[args.length - 1])}`;
          pendingCommands.add(key);
          if (String(args[args.length - 1]) === "ultra-rss-reader") {
            await new Promise<void>((resolve) => {
              releaseCommands.set(key, resolve);
            });
          }
          const error = new Error("not found") as NodeJS.ErrnoException;
          error.code = "1";
          throw error;
        },
      });

      // Polling is intentionally sequential: each tick observes whether the concurrent guard started.
      for (let index = 0; index < 10 && ![...pendingCommands].some((key) => key.startsWith("lsof:")); index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      expect([...pendingCommands].some((key) => key.startsWith("pgrep:"))).toBe(true);
      expect([...pendingCommands].some((key) => key.startsWith("lsof:"))).toBe(true);

      for (const releaseCommand of releaseCommands.values()) {
        releaseCommand();
      }

      await expect(resultPromise).resolves.toMatchObject({
        copied: [path.join(devDir, "ultra-rss-reader.db")],
        backedUp: [path.join(devDir, "ultra-rss-reader.db")],
      });
      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("prod-db");
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
      await Promise.all([mkdir(prodDir, { recursive: true }), mkdir(devDir, { recursive: true })]);
      await Promise.all([
        writeFile(path.join(prodDir, "ultra-rss-reader.db"), "prod-db"),
        writeFile(path.join(devDir, "ultra-rss-reader.db"), "dev-db"),
      ]);

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
