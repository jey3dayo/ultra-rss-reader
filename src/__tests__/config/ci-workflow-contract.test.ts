import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readMiseTaskCorpus() {
  return ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
    .map(readRepoFile)
    .join("\n");
}

function enginesNodeVersion() {
  return packageJson.engines.node;
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
    const checkJobSections = extractCheckJobSections(ciWorkflow);

    for (const { jobId, section } of checkJobSections) {
      const setupIndex = section.indexOf("uses: pnpm/setup@5d160c5bc68a09337ad0d5654e237e03253b5879");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");

      expect(setupIndex, `${jobId} should use pinned pnpm/setup`).toBeGreaterThanOrEqual(0);
      expect(section, `${jobId} should install the engines.node version through pnpm runtime`).toContain(
        `runtime: node@${enginesNodeVersion()}`,
      );
      expect(section, `${jobId} should enable pnpm/setup store cache`).toContain("cache: true");
      expect(section, `${jobId} should keep frozen-lockfile install explicit`).toContain("install: false");
      expect(installIndex, `${jobId} should install after pnpm/setup`).toBeGreaterThan(setupIndex);
    }

    expect(ciWorkflow.match(/pnpm install --frozen-lockfile/g)).toHaveLength(checkJobSections.length);
    expect(ciWorkflow).not.toContain("node_modules");
  });

  it("verifies package manager and engine contracts against local mise and the CI image", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const toolchainSection = extractWorkflowJobSection(ciWorkflow, "toolchain");
    const miseSource = readMiseTaskCorpus();

    expect(toolchainSection).toContain("Verify CI image toolchain contract");
    expect(toolchainSection).toContain("node scripts/ci/check-image-toolchain.mjs");
    const imageContract = readRepoFile("scripts/ci/check-image-toolchain.mjs");
    expect(imageContract).toContain("process.versions.node");
    expect(imageContract).toContain('execFileSync("pnpm", ["--version"]');
    expect(imageContract).toContain("local mise Node version drift");
    expect(imageContract).toContain("local pnpm version drift");
    expect(miseSource).toContain('["quality:toolchain"]');
  });

  it("dry-runs every frontend lint task without passing task names to TypeScript", () => {
    const command = readRepoFile(".github/workflows/ci.yml").match(/mise run (lint:types[^\n]*)/)?.[1];
    expect(command).toBeDefined();
    const args = command?.trim().split(/\s+/) ?? [];
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "1", CLICOLOR_FORCE: "1" };
    delete env.NO_COLOR;
    const dryRun = spawnSync("mise", ["run", "--dry-run", ...args], { encoding: "utf8", env });
    expect(dryRun.status, dryRun.stderr).toBe(0);
    const rawOutput = dryRun.stdout + dryRun.stderr;
    const output = stripVTControlCharacters(rawOutput);
    expect(rawOutput).not.toBe(output);
    for (const task of [
      "lint:types",
      "lint:biome",
      "lint:md",
      "lint:yaml",
      "lint:actions",
      "lint:actions-shell",
      "lint:workflow-pins",
      "lint:ci-shell",
    ]) {
      expect(output, task).toContain(`[${task}] $`);
    }
    expect(output).toMatch(/\[lint:types\] \$ tsc --noEmit\r?\n/);
    expect(output).toContain("node scripts/ci/check-shell.ts");
    expect(readRepoFile("mise.toml")).toContain('shellcheck = "latest"');
    expect(readRepoFile("lefthook.yml")).toContain("md,yml,yaml,sh}");
  });

  it("validates the required plan and reports all results through the quality gate", () => {
    const qualityGateSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "quality-gate");
    expect(qualityGateSection).toContain("node scripts/ci/quality-gate.ts");
    expect(qualityGateSection).toContain(githubExpression("toJSON(needs)"));
    const gateCli = readRepoFile("scripts/ci/quality-gate.ts");
    expect(gateCli).toContain("Quality Gate Result Inputs");
    expect(gateCli).toContain("validateGate");
  });

  it("uses the stable Ubuntu apt mirror for Linux Tauri dependencies in lint and test", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    for (const jobId of ["rust-clippy", "test-rust"]) {
      const jobSection = extractWorkflowJobSection(ciWorkflow, jobId);

      expect(jobSection, `${jobId} should keep Tauri dependency setup Linux-only`).toContain(
        "if: matrix.os == 'ubuntu-latest'",
      );
      expect(jobSection).toContain("bash scripts/ci/install-tauri-deps.sh");
      const dependencyScript = readRepoFile("scripts/ci/install-tauri-deps.sh");
      expect(dependencyScript, `${jobId} should check apt source files before editing`).toContain(
        'if [ -f "$apt_source" ]; then',
      );
      expect(dependencyScript, `${jobId} should replace the Azure Ubuntu mirror`).toContain(
        "s|azure.archive.ubuntu.com|archive.ubuntu.com|g",
      );
      expect(dependencyScript, `${jobId} should preserve apt retries`).toContain("Acquire::Retries=3");
      expect(dependencyScript, `${jobId} should define bounded apt options`).toContain(
        "apt_options=(-o Acquire::Retries=3 -o Acquire::ForceIPv4=true -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20)",
      );
      expect(dependencyScript, `${jobId} should retry apt with a fallback mirror`).toContain(
        "mirror.math.princeton.edu/pub/ubuntu",
      );
      expect(dependencyScript, `${jobId} should bound apt update`).toContain(
        `if ! timeout 300s sudo apt-get update "\${apt_options[@]}"; then`,
      );
      expect(dependencyScript, `${jobId} should bound apt install`).toContain(
        `timeout 300s sudo apt-get install -y --no-install-recommends "\${apt_options[@]}"`,
      );
    }
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

    expect(nativeSmokeSection).toContain(
      "bash scripts/ci/run-logged.sh tmp/ci-artifacts/native-smoke/debug-build.log mise run app:build:debug",
    );
    expect(nativeSmokeSection).toContain("tmp/ci-artifacts/native-smoke/debug-build.log");
    expect(nativeSmokeSection).toContain("src-tauri/target/debug/bundle/");
    expect(nativeSmokeSection.match(/if: failure\(\)/g)?.length ?? 0).toBe(2);
  });
});
