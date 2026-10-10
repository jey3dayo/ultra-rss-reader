import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReleaseProvenanceRecord, ReleaseProvenanceError } from "../scripts/release/artifacts.ts";

const SCRATCH_ROOT = resolve("tmp/provenance-fixture-1009");
const RELEASE_PROVENANCE_DIR = "src-tauri/target/release-provenance";
const SOURCE_SHA = "a".repeat(40);

const RELEASE_ENV = {
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

const assetPlatformFor = (runnerOs: string): string => (runnerOs === "macOS" ? "darwin-aarch64" : "windows-x86_64");

const sha256Of = (content: string): string => createHash("sha256").update(content).digest("hex");

const fakeGit = (args: readonly string[]): string => {
  const key = args.join(" ");
  const outputs: Record<string, string> = {
    "rev-parse HEAD": SOURCE_SHA,
    "rev-parse refs/tags/v1.2.3^{}": SOURCE_SHA,
    [`log -1 --format=%s ${SOURCE_SHA}`]: "release fixture (#123)",
  };
  const output = outputs[key];
  if (output === undefined) {
    throw new Error(`unexpected git invocation: ${key}`);
  }
  return output;
};

const buildInProcess = (runnerOs: string, artifactName: string, checksumLine?: string) => {
  const assetPlatform = assetPlatformFor(runnerOs);
  const artifactSha256 = sha256Of("isolated release artifact bytes\n");
  const files: Record<string, string> = {
    "package.json": '{"type":"module","version":"1.2.3"}\n',
    "src-tauri/target/updater-checksum-assets.txt": `src-tauri/target/${artifactName}.sha256\n`,
    [`src-tauri/target/${artifactName}.sha256`]: checksumLine ?? `${artifactSha256}  ${artifactName}\n`,
    "src-tauri/target/release-dependency-provenance-assets.txt": `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-${assetPlatform}.json\n${RELEASE_PROVENANCE_DIR}/cargo-licenses-${assetPlatform}.json\n`,
  };
  return {
    artifactSha256,
    assetPlatform,
    result: () =>
      buildReleaseProvenanceRecord({
        env: { ...RELEASE_ENV, RUNNER_OS: runnerOs },
        git: fakeGit,
        readFile: (filePath) => {
          const content = files[filePath];
          if (content === undefined) {
            throw new Error(`unexpected read: ${filePath}`);
          }
          return content;
        },
      }),
  };
};

describe("release provenance artifact filename", () => {
  it.each([
    { artifactName: "Ultra RSS Reader.app.tar.gz", runnerOs: "macOS" },
    {
      artifactName: "Ultra.RSS.Reader_1.2.3_x64-setup.exe",
      runnerOs: "Windows",
    },
  ])("preserves the checksum artifact name for $runnerOs", ({ artifactName, runnerOs }) => {
    const build = buildInProcess(runnerOs, artifactName);
    const { assetPlatform, record } = build.result();

    expect(assetPlatform).toBe(build.assetPlatform);
    expect(record.artifact.name).toBe(artifactName);
    expect(record.artifact.sha256).toBe(build.artifactSha256);
    expect(record.artifact.checksumAssetName).toBe(`${artifactName}.sha256`);
    expect(record.dependencyProvenanceAssets).toEqual([
      `pnpm-licenses-${build.assetPlatform}.json`,
      `cargo-licenses-${build.assetPlatform}.json`,
    ]);
    expect(record.packageVersion).toBe("1.2.3");
    expect(record.pullRequest).toEqual({ mergeCommitSubject: "release fixture (#123)", number: "123" });
    expect(record.source).toEqual({ commitSha: SOURCE_SHA, tagTargetSha: SOURCE_SHA });
    expect(record.workflow.runUrl).toBe("https://github.example.test/fixture/ultra-rss-reader/actions/runs/123456");
  });

  it("rejects a missing checksum line before producing a provenance record", () => {
    const build = buildInProcess("macOS", "Ultra RSS Reader.app.tar.gz", "\n");

    expect(build.result).toThrow(ReleaseProvenanceError);
    expect(build.result).toThrow("invalid updater checksum line");
  });

  it("rejects an invalid digest before producing a provenance record", () => {
    const artifactName = "Ultra RSS Reader.app.tar.gz";
    const build = buildInProcess("macOS", artifactName, `invalid-digest  ${artifactName}\n`);

    expect(build.result).toThrow(ReleaseProvenanceError);
    expect(build.result).toThrow(`invalid updater checksum digest for ${artifactName}`);
  });
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const populateCliFixture = (fixtureRoot: string, artifactName: string) => {
  const emptyGlobalGitConfig = join(fixtureRoot, "empty-git-global.config");
  writeFileSync(emptyGlobalGitConfig, "");
  const hooksDirectory = join(fixtureRoot, "empty-hooks");
  mkdirSync(hooksDirectory);
  const inheritedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("GIT_")),
  );
  const env: NodeJS.ProcessEnv = {
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
    ...RELEASE_ENV,
    RUNNER_OS: "macOS",
  };

  for (const args of [
    ["init", "--quiet"],
    ["commit", "--quiet", "--allow-empty", "-m", "release fixture (#123)"],
    ["tag", "-a", "v1.2.3", "--message", "fixture tag"],
  ]) {
    execFileSync("git", args, { cwd: fixtureRoot, env });
  }

  const scriptPath = join(fixtureRoot, "scripts/release/artifacts.ts");
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(resolve("scripts/release/artifacts.ts"), scriptPath);
  copyFileSync(
    resolve("scripts/release/updater-checksum.ts"),
    join(fixtureRoot, "scripts/release/updater-checksum.ts"),
  );
  writeFileSync(join(fixtureRoot, "package.json"), '{"type":"module","version":"1.2.3"}\n');

  const targetDirectory = join(fixtureRoot, "src-tauri/target");
  mkdirSync(join(fixtureRoot, RELEASE_PROVENANCE_DIR), { recursive: true });
  const artifactBytes = "isolated release artifact bytes\n";
  writeFileSync(join(targetDirectory, artifactName), artifactBytes);
  const checksumAssetPath = join(targetDirectory, `${artifactName}.sha256`);
  writeFileSync(join(targetDirectory, "updater-checksum-assets.txt"), `src-tauri/target/${artifactName}.sha256\n`);

  const assetPlatform = assetPlatformFor("macOS");
  const dependencyAssets = [`pnpm-licenses-${assetPlatform}.json`, `cargo-licenses-${assetPlatform}.json`];
  for (const dependencyAsset of dependencyAssets) {
    writeFileSync(join(fixtureRoot, RELEASE_PROVENANCE_DIR, dependencyAsset), "{}\n");
  }
  writeFileSync(
    join(targetDirectory, "release-dependency-provenance-assets.txt"),
    `${dependencyAssets.map((asset) => `${RELEASE_PROVENANCE_DIR}/${asset}`).join("\n")}\n`,
  );

  return {
    artifactSha256: sha256Of(artifactBytes),
    assetPlatform,
    checksumAssetPath,
    env,
    fixtureRoot,
    run: () =>
      spawnSync(process.execPath, [scriptPath, "generate-release-provenance"], {
        cwd: fixtureRoot,
        encoding: "utf8",
        env,
      }),
  };
};

const createCliFixture = (artifactName: string) => {
  mkdirSync(SCRATCH_ROOT, { recursive: true });
  const fixtureRoot = mkdtempSync(join(SCRATCH_ROOT, "cli-"));
  try {
    return populateCliFixture(fixtureRoot, artifactName);
  } catch (error) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
};

describe("release provenance CLI", () => {
  it("rejects an unknown command with a nonzero exit when invoked through a symlinked path", () => {
    const linkRoot = mkdtempSync(join(tmpdir(), "release-artifacts-link-"));
    try {
      symlinkSync(resolve("scripts"), join(linkRoot, "scripts"), process.platform === "win32" ? "junction" : "dir");
      const result = spawnSync(process.execPath, [join(linkRoot, "scripts/release/artifacts.ts"), "bogus"], {
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("::error::unknown release artifacts command bogus");
    } finally {
      rmSync(linkRoot, { recursive: true, force: true });
    }
  });

  it("writes the provenance record from real git state and reports invalid checksums without writing upload assets", () => {
    const artifactName = "Ultra RSS Reader.app.tar.gz";
    const fixture = createCliFixture(artifactName);
    const assetsListPath = join(fixture.fixtureRoot, "src-tauri/target/release-provenance-assets.txt");
    const recordPath = join(
      fixture.fixtureRoot,
      RELEASE_PROVENANCE_DIR,
      `release-provenance-${fixture.assetPlatform}.json`,
    );

    try {
      writeFileSync(fixture.checksumAssetPath, `invalid-digest  ${artifactName}\n`);
      const rejected = fixture.run();
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain(`::error::invalid updater checksum digest for ${artifactName}`);
      expect(existsSync(assetsListPath)).toBe(false);
      expect(existsSync(recordPath)).toBe(false);

      writeFileSync(fixture.checksumAssetPath, `${fixture.artifactSha256}  ${artifactName}\n`);
      const result = fixture.run();
      expect(result.status, result.stderr ?? result.stdout ?? "").toBe(0);

      const parsed: unknown = JSON.parse(readFileSync(recordPath, "utf8"));
      if (!isRecord(parsed) || !isRecord(parsed.artifact) || !isRecord(parsed.source)) {
        throw new Error("release provenance artifact record is missing");
      }
      expect(parsed.artifact.name).toBe(artifactName);
      expect(parsed.artifact.sha256).toBe(fixture.artifactSha256);
      expect(parsed.source.commitSha).toBe(parsed.source.tagTargetSha);
      expect(readFileSync(assetsListPath, "utf8")).toBe(
        `${RELEASE_PROVENANCE_DIR}/release-provenance-${fixture.assetPlatform}.json\n`,
      );
    } finally {
      rmSync(fixture.fixtureRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
