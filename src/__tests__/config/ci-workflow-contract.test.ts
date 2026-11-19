import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function githubExpression(expression: string) {
  return [`${String.fromCharCode(36)}{{`, expression, "}}"].join(" ");
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
  it("sets up Node through mise and pnpm through the pinned pnpm setup action before frozen installs", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const checkJobSections = extractCheckJobSections(ciWorkflow);

    const rustOnlyJobIds = ["rust-clippy", "test-rust"];
    const installFreeJobIds = [...rustOnlyJobIds, "audit"];

    for (const { jobId, section } of checkJobSections) {
      const miseIndex = section.indexOf("uses: jdx/mise-action@");
      const setupIndex = section.indexOf("uses: $/.github/actions/setup-pnpm");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");

      expect(miseIndex, `${jobId} should install Node through mise`).toBeGreaterThanOrEqual(0);
      if (rustOnlyJobIds.includes(jobId)) {
        expect(setupIndex, `${jobId} runs no pnpm command and should not set up pnpm`).toBe(-1);
      } else {
        expect(setupIndex, `${jobId} should set up pnpm after mise`).toBeGreaterThan(miseIndex);
      }
      if (installFreeJobIds.includes(jobId)) {
        expect(installIndex, `${jobId} uses no node_modules and should not install`).toBe(-1);
      } else {
        expect(installIndex, `${jobId} should install after pnpm/setup`).toBeGreaterThan(setupIndex);
      }
    }

    expect(ciWorkflow.match(/pnpm install --frozen-lockfile/g)).toHaveLength(
      checkJobSections.length - installFreeJobIds.length,
    );
    expect(ciWorkflow).not.toContain("node_modules");
  });

  it("dry-runs every frontend lint task without passing task names to TypeScript", () => {
    const command = readRepoFile(".github/workflows/ci.yml").match(/mise run (lint:types[^\n]*)/)?.[1];
    expect(command).toBeDefined();
    const args = command?.trim().split(/\s+/) ?? [];
    const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "1", CLICOLOR_FORCE: "1" };
    delete env.NO_COLOR;
    const dryRun = spawnSync("mise", ["run", "--dry-run", ...args], { encoding: "utf8", env });
    expect(dryRun.status, dryRun.stderr).toBe(0);
    const output = stripVTControlCharacters(dryRun.stdout + dryRun.stderr);
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
  });

  it("validates the required plan and reports all results through the quality gate", () => {
    const qualityGateSection = extractWorkflowJobSection(readRepoFile(".github/workflows/ci.yml"), "quality-gate");
    expect(qualityGateSection).toContain("node scripts/ci/quality-gate.ts");
    expect(qualityGateSection).toContain(githubExpression("toJSON(needs)"));
    const gateCli = readRepoFile("scripts/ci/quality-gate.ts");
    expect(gateCli).toContain("validateGate");
  });

  it("sets up Linux Tauri dependencies only on Ubuntu in lint and test jobs", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    for (const jobId of ["rust-clippy", "test-rust"]) {
      const jobSection = extractWorkflowJobSection(ciWorkflow, jobId);

      expect(jobSection, `${jobId} should keep Tauri dependency setup Linux-only`).toContain(
        "if: matrix.os == 'ubuntu-latest'",
      );
      expect(jobSection).toContain("uses: $/.github/actions/setup-tauri-linux-deps");
    }
  });

  it("classifies CI failure artifact retention by frontend, Rust, and native smoke families", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(ciWorkflow.match(/retention-days: 7/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(ciWorkflow.match(/retention-days: 14/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(ciWorkflow.match(/retention-days: 21/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("uploads native smoke debug build logs and artifacts", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const nativeSmokeSection = extractWorkflowJobSection(ciWorkflow, "native-smoke");
    const macosNativeSection = extractWorkflowJobSection(ciWorkflow, "macos-native");

    expect(nativeSmokeSection).toContain("tmp/ci-artifacts/native-smoke/debug-build.log");
    expect(nativeSmokeSection).toContain("src-tauri/target/debug/bundle/");
    expect(macosNativeSection).not.toContain("mise run lint:clippy");
    expect(macosNativeSection).toContain("mise run app:build:debug");
  });

  it("runs macOS clippy and the credential session policy in the rust-clippy matrix", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const clippySection = extractWorkflowJobSection(ciWorkflow, "rust-clippy");

    expect(clippySection).toMatch(
      /if: matrix\.os == 'macos-latest'\n\s+shell: bash\n\s+run: bash scripts\/ci\/repair-macos-rustup\.sh/,
    );
    expect(clippySection).toContain(
      "if: matrix.os == 'macos-latest' && needs.change-plan.outputs.credentials == 'true'",
    );
  });
});
