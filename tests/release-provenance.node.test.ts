import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type ProvenanceFixture = {
  artifactName: string;
  artifactSha256: string;
  assetPlatform: string;
  checksumAssetPath: string;
  env: NodeJS.ProcessEnv;
  fixtureRoot: string;
};

type ProvenanceGitFixture = {
  env: NodeJS.ProcessEnv;
  fixtureRoot: string;
};

const SCRATCH_ROOT = resolve("tmp/provenance-fixture-1009");
const RELEASE_PROVENANCE_DIR = "src-tauri/target/release-provenance";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createGitFixture = (): ProvenanceGitFixture => {
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  const fixtureRoot = mkdtempSync(join(SCRATCH_ROOT, "git-"));
  const emptyGlobalGitConfig = join(fixtureRoot, "empty-git-global.config");
  writeFileSync(emptyGlobalGitConfig, "");
  const hooksDirectory = join(fixtureRoot, "empty-hooks");
  mkdirSync(hooksDirectory);
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  const gitEnv: NodeJS.ProcessEnv = {
    ...inheritedEnvironment,
    GIT_CONFIG_GLOBAL: emptyGlobalGitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "5",
    GIT_CONFIG_KEY_0: "user.name",
    GIT_CONFIG_VALUE_0: "Release Fixture",
    GIT_CONFIG_KEY_1: "user.email",
    GIT_CONFIG_VALUE_1: "release-fixture@example.invalid",
    GIT_CONFIG_KEY_2: "commit.gpgsign",
    GIT_CONFIG_VALUE_2: "false",
    GIT_CONFIG_KEY_3: "tag.gpgsign",
    GIT_CONFIG_VALUE_3: "false",
    GIT_CONFIG_KEY_4: "core.hooksPath",
    GIT_CONFIG_VALUE_4: hooksDirectory,
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/tags/v1.2.3",
    GITHUB_REF_NAME: "v1.2.3",
    GITHUB_REPOSITORY: "fixture/ultra-rss-reader",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123456",
    GITHUB_SERVER_URL: "https://github.example.test",
    GITHUB_WORKFLOW: "Release",
    RELEASE_TAG: "v1.2.3",
  };

  try {
    for (const args of [
      ["init", "--quiet"],
      ["commit", "--quiet", "--allow-empty", "-m", "release fixture (#123)"],
      ["tag", "-a", "v1.2.3", "--message", "fixture tag"],
    ]) {
      execFileSync("git", args, { cwd: fixtureRoot, env: gitEnv });
    }

    return {
      env: { ...gitEnv, GIT_DIR: join(fixtureRoot, ".git") },
      fixtureRoot,
    };
  } catch (error) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
};

let sharedGitFixture: ProvenanceGitFixture | undefined;

beforeAll(() => {
  sharedGitFixture = createGitFixture();
});

afterAll(() => {
  if (sharedGitFixture) {
    rmSync(sharedGitFixture.fixtureRoot, { recursive: true, force: true });
  }
});

const createFixture = (runnerOs: string, artifactName: string): ProvenanceFixture => {
  if (!sharedGitFixture) {
    throw new Error("release provenance Git fixture is not initialized");
  }

  mkdirSync(SCRATCH_ROOT, { recursive: true });
  const fixtureRoot = mkdtempSync(join(SCRATCH_ROOT, "fixture-"));
  const scriptPath = join(fixtureRoot, "scripts/release/artifacts.ts");
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(resolve("scripts/release/artifacts.ts"), scriptPath);
  copyFileSync(
    resolve("scripts/release/updater-checksum.ts"),
    join(fixtureRoot, "scripts/release/updater-checksum.ts"),
  );

  writeFileSync(join(fixtureRoot, "package.json"), '{"type":"module","version":"1.2.3"}\n');

  const targetDirectory = join(fixtureRoot, "src-tauri/target");
  mkdirSync(targetDirectory, { recursive: true });
  const artifactBytes = "isolated release artifact bytes\n";
  const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
  const artifactPath = join(targetDirectory, artifactName);
  writeFileSync(artifactPath, artifactBytes);

  const checksumAssetPath = `${artifactPath}.sha256`;
  writeFileSync(checksumAssetPath, `${artifactSha256}  ${artifactName}\n`);
  writeFileSync(join(targetDirectory, "updater-checksum-assets.txt"), `src-tauri/target/${artifactName}.sha256\n`);

  const assetPlatform = runnerOs === "macOS" ? "darwin-aarch64" : "windows-x86_64";
  const releaseProvenanceDirectory = join(fixtureRoot, RELEASE_PROVENANCE_DIR);
  mkdirSync(releaseProvenanceDirectory, { recursive: true });
  const dependencyAssets = [`pnpm-licenses-${assetPlatform}.json`, `cargo-licenses-${assetPlatform}.json`];
  for (const dependencyAsset of dependencyAssets) {
    writeFileSync(join(releaseProvenanceDirectory, dependencyAsset), "{}\n");
  }
  writeFileSync(
    join(targetDirectory, "release-dependency-provenance-assets.txt"),
    `${dependencyAssets.map((asset) => `${RELEASE_PROVENANCE_DIR}/${asset}`).join("\n")}\n`,
  );

  const env: NodeJS.ProcessEnv = {
    ...sharedGitFixture.env,
    GIT_WORK_TREE: fixtureRoot,
    RUNNER_OS: runnerOs,
  };

  return {
    artifactName,
    artifactSha256,
    assetPlatform,
    checksumAssetPath,
    env,
    fixtureRoot,
  };
};

const runCommand = (fixture: ProvenanceFixture, command: string) =>
  spawnSync(process.execPath, [join(fixture.fixtureRoot, "scripts/release/artifacts.ts"), command], {
    cwd: fixture.fixtureRoot,
    encoding: "utf8",
    env: fixture.env,
  });

const withFixture = (runnerOs: string, artifactName: string, callback: (fixture: ProvenanceFixture) => void): void => {
  const fixture = createFixture(runnerOs, artifactName);
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.fixtureRoot, { recursive: true, force: true });
  }
};

describe("release provenance artifact filename", () => {
  it.each([
    { artifactName: "Ultra RSS Reader.app.tar.gz", runnerOs: "macOS" },
    {
      artifactName: "Ultra.RSS.Reader_1.2.3_x64-setup.exe",
      runnerOs: "Windows",
    },
  ])("preserves the checksum artifact name for $runnerOs", ({ artifactName, runnerOs }) => {
    withFixture(runnerOs, artifactName, (fixture) => {
      const result = runCommand(fixture, "generate-release-provenance");
      expect(result.status, result.stderr ?? result.stdout ?? "").toBe(0);

      const recordPath = join(
        fixture.fixtureRoot,
        RELEASE_PROVENANCE_DIR,
        `release-provenance-${fixture.assetPlatform}.json`,
      );
      const parsed: unknown = JSON.parse(readFileSync(recordPath, "utf8"));
      if (!isRecord(parsed) || !isRecord(parsed.artifact)) {
        throw new Error("release provenance artifact record is missing");
      }

      expect(parsed.artifact.name).toBe(fixture.artifactName);
      expect(parsed.artifact.sha256).toBe(fixture.artifactSha256);
    });
  });

  it("rejects a missing checksum line before writing provenance upload assets", () => {
    withFixture("macOS", "Ultra RSS Reader.app.tar.gz", (fixture) => {
      writeFileSync(fixture.checksumAssetPath, "\n");

      const result = runCommand(fixture, "generate-release-provenance");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("::error::invalid updater checksum line");
      expect(existsSync(join(fixture.fixtureRoot, "src-tauri/target/release-provenance-assets.txt"))).toBe(false);
      expect(
        existsSync(
          join(fixture.fixtureRoot, RELEASE_PROVENANCE_DIR, `release-provenance-${fixture.assetPlatform}.json`),
        ),
      ).toBe(false);
    });
  });

  it("rejects an invalid digest before writing provenance upload assets", () => {
    withFixture("macOS", "Ultra RSS Reader.app.tar.gz", (fixture) => {
      writeFileSync(fixture.checksumAssetPath, `invalid-digest  ${fixture.artifactName}\n`);

      const result = runCommand(fixture, "generate-release-provenance");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(`::error::invalid updater checksum digest for ${fixture.artifactName}`);
      expect(existsSync(join(fixture.fixtureRoot, "src-tauri/target/release-provenance-assets.txt"))).toBe(false);
      expect(
        existsSync(
          join(fixture.fixtureRoot, RELEASE_PROVENANCE_DIR, `release-provenance-${fixture.assetPlatform}.json`),
        ),
      ).toBe(false);
    });
  });
});
