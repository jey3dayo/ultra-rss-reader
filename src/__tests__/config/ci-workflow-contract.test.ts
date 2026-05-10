import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
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
  it("includes Node, pnpm, and mise version drift in ci.yml pnpm cache keys", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    for (const { jobId, section } of extractCheckJobSections(ciWorkflow)) {
      expect(section, `${jobId} should resolve toolchain cache versions`).toContain("id: toolchain-cache");
      expect(section, `${jobId} should include Node version in cache key`).toContain(
        githubExpression("steps.toolchain-cache.outputs.node"),
      );
      expect(section, `${jobId} should include pnpm version in cache key`).toContain(
        githubExpression("steps.toolchain-cache.outputs.pnpm"),
      );
      expect(section, `${jobId} should include mise version in cache key`).toContain(
        githubExpression("steps.toolchain-cache.outputs.mise"),
      );
      expect(section, `${jobId} should keep lockfile content in cache key`).toContain(
        githubExpression("hashFiles('pnpm-lock.yaml')"),
      );
    }
  });

  it("verifies package manager and engine contracts against local mise and the CI image", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const toolchainSection = extractWorkflowJobSection(ciWorkflow, "toolchain");
    const miseSource = readRepoFile("mise.toml");
    const packageJsonSource = readRepoFile("package.json");

    expect(toolchainSection).toContain("Verify CI image toolchain contract");
    expect(toolchainSection).toContain("process.versions.node");
    expect(toolchainSection).toContain('execFileSync("pnpm", ["--version"]');
    expect(toolchainSection).toContain("local mise Node version drift");
    expect(toolchainSection).toContain("local pnpm version drift");
    expect(miseSource).toContain('[tasks."quality:toolchain"]');
    expect(packageJsonSource).toContain('"packageManager": "pnpm@10.33.4"');
    expect(packageJsonSource).toContain('"node": "24"');
    expect(packageJsonSource).toContain('"pnpm": "10.33.4"');
  });

  it("explains skipped and cancelled required matrix results in the quality gate step summary", () => {
    const qualityGateSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "quality-gate");

    expect(qualityGateSection).toContain("Quality Gate Result Inputs");
    expect(qualityGateSection).toContain('[ "$result" = "skipped" ] || [ "$result" = "cancelled" ]');
    expect(qualityGateSection).toContain(
      "failure because every required CI matrix must complete successfully before merge.",
    );
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
