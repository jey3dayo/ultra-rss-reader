import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  extractIssueTemplateDoneWhenDescription,
  extractIssueTemplateDoneWhenPlaceholder,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "./helpers/repo-contract-parser";

type PackageJson = {
  name: string;
  private: boolean;
  version: string;
};

type TauriConfig = {
  productName: string;
  version: string;
  identifier: string;
  bundle?: {
    createUpdaterArtifacts?: boolean;
  };
};

const readText = (path: string): string => readFileSync(path, "utf8");

const extractTomlString = (source: string, key: string): string => {
  const value = source.match(new RegExp(`^${key} = "([^"]+)"$`, "m"))?.[1];
  if (!value) {
    throw new Error(`Missing TOML string: ${key}`);
  }
  return value;
};

const extractReleaseCacheBlock = (source: string): string => {
  const value = source.match(
    /- uses: actions\/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae\n(?<block>(?: {8}.+\n?)*)/,
  )?.groups?.block;
  if (!value) {
    throw new Error("Missing release pnpm cache block");
  }
  return value;
};

const extractTaskBlock = (source: string, taskName: string): string => {
  const escapedTaskName = taskName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = source.match(
    new RegExp(`\\[tasks\\."${escapedTaskName}"\\]\\n(?<block>[\\s\\S]*?)(?=\\n\\[tasks\\.|$)`),
  )?.groups?.block;
  if (!value) {
    throw new Error(`Missing mise task block: ${taskName}`);
  }
  return value;
};

const extractCacheBlocks = (source: string): string[] => {
  const cachePattern = /- uses: actions\/cache@[^\n]+\n(?<block>(?: {8}.+\n?)*)/g;
  return [...source.matchAll(cachePattern)].map((match) => match.groups?.block ?? "");
};

const extractWorkflowUses = (source: string): string[] => {
  const usesPattern = /^\s*-\s+uses:\s+([^\s#]+)$/gm;
  return [...source.matchAll(usesPattern)].map((match) => match[1] ?? "");
};

describe("release repository contract", () => {
  const packageJson: PackageJson = JSON.parse(readText("package.json"));
  const tauriConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
  const tauriReleaseConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.release.conf.json"));
  const cargoToml = readText("src-tauri/Cargo.toml");
  const releaseWorkflow = readText(".github/workflows/release.yml");
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const labelerWorkflow = readText(".github/workflows/labeler.yml");
  const prInsightsLabelerWorkflow = readText(".github/workflows/pr-insights-labeler.yml");
  const releaseConfig = readText(".github/release.yml");
  const labelerConfig = readText(".github/labeler.yml");
  const pullRequestTemplate = readText(".github/PULL_REQUEST_TEMPLATE.md");
  const issueTemplateFileNames = readdirSync(".github/ISSUE_TEMPLATE").filter(
    (fileName) => fileName.endsWith(".yml") && fileName !== "config.yml",
  );
  const miseToml = readText("mise.toml");

  it("keeps release tag, package, Tauri, and Cargo versions in one parity contract", () => {
    expect(packageJson.version).toBe(tauriConfig.version);
    expect(packageJson.version).toBe(extractTomlString(cargoToml, "version"));
    expect(releaseWorkflow).toContain("Validate release version parity");
    expect(releaseWorkflow).toContain("release tag $" + "{releaseTag}");
    expect(releaseWorkflow).toContain("src-tauri/tauri.conf.json version");
    expect(releaseWorkflow).toContain("src-tauri/Cargo.toml version");
  });

  it("serializes tag push and manual release runs by release tag", () => {
    expect(releaseWorkflow).toContain(
      "group: $" +
        "{{ github.workflow }}-$" +
        "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}",
    );
    expect(releaseWorkflow).toContain("cancel-in-progress: false");
    expect(releaseWorkflow).toContain("workflow_dispatch");
    expect(releaseWorkflow).toContain("push:");
    expect(releaseWorkflow).toContain('tags: ["v*"]');
  });

  it("checks release source and version parity before artifact creation", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain("ref: >-");
    expect(releaseWorkflow).toContain("format('refs/tags/{0}', inputs.release_tag) || github.ref");
    expect(releaseWorkflow).toContain('if [[ "$EVENT_NAME" == "push" ]]; then');
    expect(releaseWorkflow).toContain('if [[ "$EVENT_NAME" == "workflow_dispatch" ]]; then');
    expect(releaseWorkflow).toContain("tag push ref $WORKFLOW_REF does not match release tag $RELEASE_TAG");
    expect(releaseWorkflow).toContain("manual dispatch ref $WORKFLOW_REF does not match release tag $RELEASE_TAG");
    expect(releaseWorkflow).toContain(
      'git fetch --force --tags origin "refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
    );
    expect(releaseWorkflow).toContain('tag_target_sha="$(git rev-parse "refs/tags/$RELEASE_TAG^{}")"');
    expect(releaseWorkflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(releaseWorkflow.indexOf("Validate release source")).toBeLessThan(
      releaseWorkflow.indexOf("Resolve pnpm store path"),
    );
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Preflight release build")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps release dependency cache exact-lockfile only", () => {
    const releaseCacheBlock = extractReleaseCacheBlock(releaseWorkflow);

    expect(releaseCacheBlock).toContain(
      "key: $" + "{{ runner.os }}-pnpm-store-$" + "{{ hashFiles('pnpm-lock.yaml') }}",
    );
    expect(releaseCacheBlock).not.toContain("restore-keys:");
  });

  it("keeps CI pnpm cache restore keys bounded by frozen lockfile installs", () => {
    const ciCacheBlocks = extractCacheBlocks(ciWorkflow);

    expect(ciCacheBlocks.length).toBeGreaterThan(0);
    for (const cacheBlock of ciCacheBlocks) {
      expect(cacheBlock).toContain("key: $" + "{{ runner.os }}-pnpm-store-$" + "{{ hashFiles('pnpm-lock.yaml') }}");
      expect(cacheBlock).toContain("restore-keys:");
      expect(cacheBlock).toContain("$" + "{{ runner.os }}-pnpm-store-");
    }
    expect(ciWorkflow.match(/pnpm install --frozen-lockfile/g)).toHaveLength(ciCacheBlocks.length);
    expect(ciWorkflow).not.toContain("node_modules");
  });

  it("pins third-party actions in all workflows to commit SHAs", () => {
    const workflows = [
      [".github/workflows/ci.yml", ciWorkflow],
      [".github/workflows/labeler.yml", labelerWorkflow],
      [".github/workflows/pr-insights-labeler.yml", prInsightsLabelerWorkflow],
      [".github/workflows/release.yml", releaseWorkflow],
    ] as const;

    for (const [workflowPath, workflow] of workflows) {
      const usesValues = extractWorkflowUses(workflow);

      expect(usesValues.length, workflowPath).toBeGreaterThan(0);
      for (const usesValue of usesValues) {
        expect(usesValue, workflowPath).toMatch(/@[0-9a-f]{40}$/i);
      }
    }

    expect(extractTaskBlock(miseToml, "lint:workflow-pins")).toContain('const workflowsDir = ".github/workflows"');
  });

  it("keeps CI apt mirror failures bounded by an explicit retry policy", () => {
    expect(ciWorkflow.match(/sudo apt-get update -o Acquire::Retries=3/g)).toHaveLength(2);
    expect(
      ciWorkflow.match(
        /sudo apt-get install -y --no-install-recommends -o Acquire::Retries=3 \$\{\{ env\.TAURI_SYSTEM_DEPS \}\}/g,
      ),
    ).toHaveLength(2);
    expect(ciWorkflow).not.toContain("sudo apt-get install -y $" + "{{ env.TAURI_SYSTEM_DEPS }}");
  });

  it("keeps actionlint shellcheck disabled only with a paired shell gate", () => {
    expect(miseToml).toContain('shellcheck = "latest"');
    expect(miseToml).toContain('"lint:actions-shell"');
    expect(extractTaskBlock(miseToml, "lint:actions")).toContain("actionlint -shellcheck=");
    expect(extractTaskBlock(miseToml, "lint:actions-shell")).toContain('run = "actionlint"');
  });

  it("documents the intentionally narrow Windows Rust test scope", () => {
    const rustTestTask = extractTaskBlock(miseToml, "test:rust");

    expect(rustTestTask).toContain("Windows CI is scoped to integration_test");
    expect(rustTestTask).toContain("Linux runs the full Rust suite");
    expect(rustTestTask).toContain('run = "rtk test cargo test --manifest-path src-tauri/Cargo.toml"');
    expect(rustTestTask).toContain(
      'run_windows = "cargo test --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target/test-rust --test integration_test"',
    );
    expect(extractTaskBlock(miseToml, "test:ci")).toContain('depends = ["test:rust", "test:unit:ci"]');
    expect(ciWorkflow).toContain("mise run test:ci");
    expect(ciWorkflow).not.toMatch(/\brun:\s+cargo test\b/);
  });

  it("keeps release artifact display metadata source-of-truth explicit", () => {
    expect(packageJson.name).toBe("ultra-rss-reader");
    expect(packageJson.private).toBe(true);
    expect(extractTomlString(cargoToml, "name")).toBe(packageJson.name);
    expect(extractTomlString(cargoToml, "description")).toBe("A Tauri-based RSS reader");
    expect(tauriConfig.productName).toBe("Ultra RSS Reader");
    expect(tauriConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
  });

  it("keeps dependency audit manual until advisory policy is defined", () => {
    expect(miseToml).toContain('[tasks."audit:deps"]');
    expect(miseToml).toContain("Manual dependency security audit");
    expect(ciWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(releaseWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(miseToml).not.toMatch(/depends = \[[^\]]*"audit:deps"/);
  });

  it("keeps release note category labels covered by issue and PR label contracts", () => {
    const issueTemplateLabels = issueTemplateFileNames.flatMap((fileName) =>
      extractYamlInlineListValues(readText(`.github/ISSUE_TEMPLATE/${fileName}`), "labels"),
    );
    const contractLabels = new Set([...extractYamlTopLevelKeys(labelerConfig), ...issueTemplateLabels]);

    for (const label of extractYamlLabelsFields(releaseConfig)) {
      expect(contractLabels.has(label), `${label} is not covered by issue templates or .github/labeler.yml`).toBe(true);
    }
  });

  it("keeps local labeler and PR insights labeler source-of-truth split explicit", () => {
    const localLabelerLabels = extractYamlTopLevelKeys(labelerConfig);
    const releaseLabels = extractYamlLabelsFields(releaseConfig);
    const prInsightsOwnedPrefixes = ["risk/", "size/"];

    expect(labelerConfig).toContain("this file owns area and release-category labels");
    expect(labelerWorkflow).toContain(".github/labeler.yml owns area and release-category labels");
    expect(prInsightsLabelerWorkflow).toContain("PR Insights owns risk/* and size/* labels only");
    expect(
      localLabelerLabels.filter((label) => prInsightsOwnedPrefixes.some((prefix) => label.startsWith(prefix))),
    ).toEqual([]);
    expect(releaseLabels.filter((label) => prInsightsOwnedPrefixes.some((prefix) => label.startsWith(prefix)))).toEqual(
      [],
    );
  });

  it("keeps issue Done When placeholders tied back to the PR DoD checklist", () => {
    const prDodChecks = ["動作確認完了", "型エラー 0 件", "リント違反 0 件", "全テスト成功", "フォーマッター適用済み"];

    for (const check of prDodChecks) {
      expect(pullRequestTemplate, `PR DoD missing ${check}`).toContain(check);
    }

    for (const fileName of issueTemplateFileNames) {
      const source = readText(`.github/ISSUE_TEMPLATE/${fileName}`);
      const doneWhenDescription = extractIssueTemplateDoneWhenDescription(source);
      const doneWhenPlaceholder = extractIssueTemplateDoneWhenPlaceholder(source);

      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain(
        "PR DoD 共通 gate",
      );
      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain("固有 gate");
      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain(
        "manual verification gate",
      );
      expect(doneWhenPlaceholder, `${fileName} Done When should reference PR DoD`).toContain(
        "PR 作成時は PR template の確認済み DoD を満たす",
      );
    }
  });
});
