import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readMiseTaskCorpus() {
  return ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
    .map(readRepoFile)
    .join("\n");
}

function githubExpression(expression: string) {
  return [`${String.fromCharCode(36)}{{`, expression, "}}"].join(" ");
}

function matrixArtifactName(prefix: string, suffix: string) {
  return `name: ${prefix}-${githubExpression("matrix.os")}-${suffix}`;
}

function extractWorkflowJobSection(source: string, jobId: string) {
  return (
    source.match(new RegExp(`^  ${jobId}:\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:\\n    name:|(?![\\s\\S]))`, "m"))?.[1] ??
    ""
  );
}

function extractCheckJobSections(source: string) {
  return [...source.matchAll(/^ {2}([A-Za-z0-9_-]+):\n([\s\S]*?)(?=^ {2}[A-Za-z0-9_-]+:\n {4}name:|(?![\s\S]))/gm)]
    .map((match) => ({
      jobId: match[1] ?? "",
      section: match[2] ?? "",
    }))
    .filter(({ section }) => /^\s+name:\s+"Check:/.test(section));
}

describe("CI workflow contract", () => {
  it("sets up pnpm and Node through the pinned pnpm setup action before frozen installs", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    for (const { jobId, section } of extractCheckJobSections(ciWorkflow)) {
      const setupIndex = section.indexOf("uses: pnpm/setup@5d160c5bc68a09337ad0d5654e237e03253b5879");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");

      expect(setupIndex, `${jobId} should use pinned pnpm/setup`).toBeGreaterThanOrEqual(0);
      expect(section, `${jobId} should install Node 24 through pnpm runtime`).toContain("runtime: node@24");
      expect(section, `${jobId} should enable pnpm/setup store cache`).toContain("cache: true");
      expect(section, `${jobId} should keep frozen-lockfile install explicit`).toContain("install: false");
      expect(installIndex, `${jobId} should install after pnpm/setup`).toBeGreaterThan(setupIndex);
    }
  });

  it("verifies package manager and engine contracts against local mise and the CI image", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const toolchainSection = extractWorkflowJobSection(ciWorkflow, "toolchain");
    const miseSource = readMiseTaskCorpus();
    const packageJsonSource = readRepoFile("package.json");

    expect(toolchainSection).toContain("Verify CI image toolchain contract");
    expect(toolchainSection).toContain("process.versions.node");
    expect(toolchainSection).toContain('execFileSync("pnpm", ["--version"]');
    expect(toolchainSection).toContain("local mise Node version drift");
    expect(toolchainSection).toContain("local pnpm version drift");
    expect(miseSource).toContain('["quality:toolchain"]');
    expect(packageJsonSource).toContain('"packageManager": "pnpm@11.8.0"');
    expect(packageJsonSource).toContain('"node": "24"');
    expect(packageJsonSource).toContain('"pnpm": "11.8.0"');
  });

  it("explains skipped and cancelled required matrix results in the quality gate step summary", () => {
    const qualityGateSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "quality-gate");

    expect(qualityGateSection).toContain("Quality Gate Result Inputs");
    expect(qualityGateSection).toContain('[ "$result" = "skipped" ] || [ "$result" = "cancelled" ]');
    expect(qualityGateSection).toContain(
      "failure because every required CI matrix must complete successfully before merge.",
    );
  });

  it("keeps test job timeout large enough for Windows post-cache cleanup", () => {
    const testSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "test");

    expect(testSection).toContain("timeout-minutes: 20");
  });

  it("classifies CI failure artifact retention by frontend, Rust, and native smoke families", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(ciWorkflow).toContain(matrixArtifactName("frontend", "lint-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("frontend", "test-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("frontend", "build-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("rust", "lint-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("rust", "test-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("native-smoke", "debug-log"));
    expect(ciWorkflow).toContain(matrixArtifactName("native-smoke", "debug-build-artifacts"));
    expect(ciWorkflow.match(/retention-days: 7/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(ciWorkflow.match(/retention-days: 14/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(ciWorkflow.match(/retention-days: 21/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("uploads native smoke debug build logs and artifacts only on failure", () => {
    const nativeSmokeSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "native-smoke");

    expect(nativeSmokeSection).toContain("mise run app:build:debug 2>&1 | tee");
    expect(nativeSmokeSection).toContain("tmp/ci-artifacts/native-smoke/debug-build.log");
    expect(nativeSmokeSection).toContain("src-tauri/target/debug/bundle/");
    expect(nativeSmokeSection.match(/if: failure\(\)/g)?.length ?? 0).toBe(2);
  });
});
