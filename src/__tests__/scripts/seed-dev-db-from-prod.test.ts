import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  buildDatabaseArtifactPaths,
  buildSeedPlan,
  detectLikelyRunningAppProcesses,
  resolveAppDataDir,
  resolveBackupDirName,
  seedDevDatabaseFromProd,
  seedDevDatabaseFromProdPlan,
} from "../../../scripts/seed-dev-db-from-prod.ts";

function normalizePathSeparators(value: string) {
  return value.replaceAll("\\", "/");
}

describe("resolveAppDataDir", () => {
  it("resolves macOS Tauri app data directories from bundle identifiers", () => {
    expect(
      normalizePathSeparators(
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
      normalizePathSeparators(
        resolveAppDataDir({
          platform: "win32",
          homeDir: "C:\\Users\\alice",
          env: { APPDATA: "C:\\Users\\alice\\AppData\\Roaming" },
          identifier: "com.ultra-rss-reader.dev",
        }),
      ),
    ).toBe("C:/Users/alice/AppData/Roaming/com.ultra-rss-reader.dev");
  });
});

describe("buildDatabaseArtifactPaths", () => {
  it("targets the SQLite database plus WAL and SHM artifacts", () => {
    expect(buildDatabaseArtifactPaths("/app-data").map(normalizePathSeparators)).toEqual([
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

    expect(plan.backupDir).toBe("/dev/backups/seed-from-prod-20260501T123456");
    expect(plan.stagingDir).toBe("/dev/backups/seed-from-prod-20260501T123456.staging");
    expect(plan.artifacts.map((artifact) => artifact.suffix)).toEqual(["", "-wal", "-shm"]);
    expect(plan.artifacts.map((artifact) => normalizePathSeparators(artifact.source))).toEqual([
      "/prod/ultra-rss-reader.db",
      "/prod/ultra-rss-reader.db-wal",
      "/prod/ultra-rss-reader.db-shm",
    ]);
    expect(plan.artifacts.map((artifact) => normalizePathSeparators(artifact.destination))).toEqual([
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
              if (String(destination).endsWith("backups/seed-from-prod-20260501T123456/ultra-rss-reader.db")) {
                throw new Error("backup failed");
              }
              await copyFile(source, destination);
            },
          },
        ),
      ).rejects.toThrow("backup failed");

      await expect(readFile(path.join(devDir, "ultra-rss-reader.db"), "utf8")).resolves.toBe("dev-db");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("seedDevDatabaseFromProd", () => {
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
