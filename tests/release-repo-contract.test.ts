import { execFileSync } from "node:child_process";
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
  scripts: Record<string, string>;
  version: string;
};

type TauriConfig = {
  productName: string;
  version: string;
  identifier: string;
  build?: {
    devUrl?: string;
  };
  bundle?: {
    createUpdaterArtifacts?: boolean;
  };
  plugins?: {
    updater?: {
      endpoints?: string[];
      pubkey?: string;
    };
  };
};

const RELEASE_UPDATER_ENDPOINT = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const RELEASE_UPDATER_ASSET_CONTRACT = [
  {
    assetPattern: ".app.tar.gz",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
    platformKey: "darwin-aarch64",
    signaturePattern: ".app.tar.gz.sig",
  },
  {
    assetPattern: "-setup.exe",
    checksumPattern: "-setup.exe.sha256",
    matrixArgs: '""',
    matrixPlatform: "windows-latest",
    platformKey: "windows-x86_64",
    signaturePattern: "-setup.exe.sig",
  },
] as const;
const UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"] as const;

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

const extractTauriActionBlock = (source: string): string => {
  const value = source.match(
    /- uses: tauri-apps\/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5\n(?<block>(?: {8}.+\n?)*)/,
  )?.groups?.block;
  if (!value) {
    throw new Error("Missing release tauri-action block");
  }
  return value;
};

const listTypeScriptSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.(?:ts|tsx)$/.test(entry))
    .map((entry) => `${dir}/${entry}`);

describe("release repository contract", () => {
  const packageJson: PackageJson = JSON.parse(readText("package.json"));
  const tauriConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
  const tauriReleaseConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.release.conf.json"));
  const tauriDevConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.dev.conf.json"));
  const defaultCapability: { permissions?: string[] } = JSON.parse(readText("src-tauri/capabilities/default.json"));
  const cargoToml = readText("src-tauri/Cargo.toml");
  const releaseWorkflow = readText(".github/workflows/release.yml");
  const tauriLib = readText("src-tauri/src/lib.rs");
  const devMocks = readText("src/dev/mocks.ts");
  const releaseManualVerification = readText("docs/release-manual-verification.md");
  const docsReadme = readText("docs/README.md");
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
    expect(releaseWorkflow.indexOf("Validate release build contamination contract")).toBeLessThan(
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

    expect(extractTaskBlock(miseToml, "lint:workflow-pins")).toContain("node scripts/check-workflow-pins.mjs");
    expect(readText("scripts/check-workflow-pins.mjs")).toContain('const workflowsDir = ".github/workflows"');
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

  it("requires the release workflow to build with the release updater config", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);

    expect(tauriActionBlock).toContain("--config src-tauri/tauri.release.conf.json");
    expect(tauriActionBlock).not.toContain('--config \'{"identifier"');
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must enable updater artifacts");
    expect(releaseWorkflow).toContain("release workflow must pass src-tauri/tauri.release.conf.json to tauri-action");
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps bundle identifier, release updater artifacts, and updater endpoint in one release contract", () => {
    expect(tauriConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([RELEASE_UPDATER_ENDPOINT]);
    expect(tauriConfig.plugins?.updater?.pubkey).toBeTruthy();
    expect(tauriConfig.plugins?.updater?.pubkey).not.toMatch(UPDATER_PUBKEY_PLACEHOLDER_PATTERN);
    expect(releaseWorkflow).toContain(RELEASE_UPDATER_ENDPOINT);
    expect(releaseWorkflow).toContain("src-tauri/tauri.conf.json updater pubkey must be configured");
  });

  it("keeps updater manifest platforms mapped back to release assets and checksums", () => {
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(releaseWorkflow).toContain("Validate updater manifest asset contract");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("latest.json updater manifest must map exactly to the release asset contract");

    for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
      expect(releaseWorkflow).toContain(`platformKey: "${contract.platformKey}"`);
      expect(releaseWorkflow).toContain(`matrixPlatform: "${contract.matrixPlatform}"`);
      expect(releaseWorkflow).toContain(`matrixArgs: ${JSON.stringify(contract.matrixArgs)}`);
      expect(releaseWorkflow).toContain(`assetPattern: "${contract.assetPattern}"`);
      expect(releaseWorkflow).toContain(`signaturePattern: "${contract.signaturePattern}"`);
      expect(releaseWorkflow).toContain(`checksumPattern: "${contract.checksumPattern}"`);
      expect(releaseWorkflow).toContain(`platform: ${contract.matrixPlatform}`);
      expect(releaseWorkflow).toContain(`args: ${contract.matrixArgs}`);
      expect(contract.signaturePattern).toBe(`${contract.assetPattern}.sig`);
      expect(contract.checksumPattern).toBe(`${contract.assetPattern}.sha256`);
    }

    for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
      expect(releaseWorkflow).toContain(`unsupportedUpdaterPlatformKeys = ["linux-x86_64", "linux-aarch64"]`);
      expect(releaseWorkflow).not.toContain(`platformKey: "${unsupportedPlatformKey}"`);
    }
  });

  it("keeps release artifact provenance evidence tied to tag, workflow, checksum, and SBOM records", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain('tag_target_sha="$(git rev-parse "refs/tags/$RELEASE_TAG^{}")"');
    expect(releaseWorkflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("Generate release dependency provenance");
    expect(releaseWorkflow).toContain("Generate release provenance record");
    expect(releaseWorkflow).toContain("Upload release provenance assets");
    expect(releaseWorkflow).toContain("mise run report:licenses");
    expect(releaseWorkflow).toContain("pnpm-licenses-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("cargo-licenses-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("release-provenance-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("workflowRunUrl");
    expect(releaseWorkflow).toContain("tagTargetSha");
    expect(releaseWorkflow).toContain('execFileSync("git", ["log", "-1", "--format=%s", sourceSha]');
    expect(releaseWorkflow).toContain("pullRequestNumber");
    expect(releaseWorkflow).toContain("mergeCommitSubject");
    expect(releaseWorkflow).toContain('execFileSync("git", ["rev-parse", "HEAD"]');
    expect(releaseWorkflow).toContain(
      'execFileSync("git", ["rev-parse", `refs/tags/$' + "{process.env.RELEASE_TAG}^{}`]",
    );
    expect(releaseWorkflow).toContain("checksumAssetName");
    expect(releaseWorkflow).toContain("expected three release provenance assets");
    expect(releaseWorkflow).toContain(
      "release provenance source $" + "{sourceSha} does not match tag target $" + "{tagTargetSha}",
    );
    expect(releaseWorkflow).toContain("releaseDraft: true");
    expect(releaseWorkflow.indexOf("Generate updater asset checksums")).toBeLessThan(
      releaseWorkflow.indexOf("Generate release provenance record"),
    );
    expect(releaseWorkflow.indexOf("Generate release provenance record")).toBeLessThan(
      releaseWorkflow.indexOf("Upload release provenance assets"),
    );
    expect(releaseManualVerification).toContain("Release Provenance And SBOM Record");
    expect(releaseManualVerification).toContain("Release tag and tag target SHA");
    expect(releaseManualVerification).toContain("PR number or merge commit subject for the source commit");
    expect(releaseManualVerification).toContain("Source commit SHA checked out by the release workflow");
    expect(releaseManualVerification).toContain("GitHub workflow run id and run URL");
    expect(releaseManualVerification).toContain("Updater checksum sidecar asset");
    expect(releaseManualVerification).toContain("Updater signature sidecar asset");
    expect(releaseManualVerification).toContain("Installed app identifier or bundle identifier");
    expect(releaseManualVerification).toContain("Quarantine and first-launch result");
    expect(releaseManualVerification).toContain("Update check smoke result from the installed published artifact");
    expect(releaseManualVerification).toContain("Windows Installer Signing And SmartScreen Verification");
    expect(releaseManualVerification).toContain("SBOM or dependency provenance record");
    expect(releaseManualVerification).toContain("Draft release attachment list before publishing");
    expect(docsReadme).toContain("Release provenance checklist");
  });

  it("keeps release builds from using dev Tauri config or dev credentials", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);
    const devOnlyImportPattern = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;
    const releaseSourceDevOnlyImports = listTypeScriptSourceFiles("src").flatMap((filePath) => {
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      return devOnlyImportPattern.test(readText(filePath)) ? [filePath] : [];
    });

    expect(tauriDevConfig.identifier).not.toBe(tauriReleaseConfig.identifier);
    expect(tauriDevConfig.productName).not.toBe(tauriConfig.productName);
    expect(tauriDevConfig.build?.devUrl).toBe("http://127.0.0.1:1420");
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri identifier");
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri product name");
    expect(releaseWorkflow).toContain("Validate release build contamination contract");
    expect(releaseWorkflow).toContain("release capability must not include debug-only MCP bridge permissions");
    expect(releaseWorkflow).toContain("release build must keep the MCP bridge plugin behind cfg(debug_assertions)");
    expect(releaseWorkflow).toContain("release build must keep dev browser mocks disabled inside Tauri");
    expect(releaseWorkflow).toContain("release source must not import dev-only mock data or scenario modules");
    expect(tauriLib).toMatch(
      /#\[cfg\(debug_assertions\)\]\s*let builder = builder\.plugin\(\s*tauri_plugin_mcp_bridge::Builder::new\(\)/,
    );
    expect(devMocks).toContain(
      "if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;",
    );
    expect(defaultCapability.permissions?.filter((permission) => permission.startsWith("mcp-bridge:"))).toEqual([]);
    expect(releaseSourceDevOnlyImports).toEqual([]);
    expect(tauriActionBlock).not.toContain("--config src-tauri/tauri.dev.conf.json");
    expect(releaseWorkflow).not.toMatch(/\bDEV_CREDENTIALS\s*:/);
    expect(releaseWorkflow).not.toMatch(/\bULTRA_RSS_DEV_CREDENTIALS\s*:/);
    expect(releaseManualVerification).toContain("Release Dev-Only Contamination Record");
    expect(releaseManualVerification).toContain("DEV_CREDENTIALS");
    expect(releaseManualVerification).toMatch(/dev mocks/i);
    expect(releaseManualVerification).toContain("debug-only MCP bridge permissions");
  });

  it("generates a release/debug feature flag inventory report", () => {
    execFileSync("node", ["./scripts/release-debug-feature-flags-report.ts"], { encoding: "utf8" });
    const report: {
      generatedBy: string;
      inventory: { area: string; flag: string; debugBehavior: string; releaseBehavior: string; evidence: string[] }[];
    } = JSON.parse(readText("tmp/release-debug-feature-flags.json"));

    expect(packageJson.scripts).toMatchObject({
      "report:release-debug-flags": "node ./scripts/release-debug-feature-flags-report.ts",
    });
    expect(report.generatedBy).toBe("scripts/release-debug-feature-flags-report.ts");
    expect(report.inventory.map((item) => item.flag)).toEqual([
      "debug_assertions",
      "VITE_DEV_INTENT",
      "@/dev/scenarios",
      "@/dev/mock-data",
      "src-tauri/tauri.dev.conf.json",
      "DEV_CREDENTIALS",
    ]);
    for (const item of report.inventory) {
      expect(item.evidence.length, item.flag).toBeGreaterThan(0);
      expect(item.debugBehavior, item.flag).not.toBe("");
      expect(item.releaseBehavior, item.flag).not.toBe("");
    }
  });

  it("keeps dependency audit manual until advisory policy is defined", () => {
    expect(miseToml).toContain('[tasks."audit:deps"]');
    expect(miseToml).toContain("Manual dependency security audit");
    expect(ciWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(releaseWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(miseToml).not.toMatch(/depends = \[[^\]]*"audit:deps"/);
  });

  it("documents schema, test fixture, dependency update, and reproducibility gates", () => {
    expect(docsReadme).toContain("Schema and query-cache contracts");
    expect(docsReadme).toContain(
      "Schema parse failure fallbacks must not enable destructive, write, or navigation actions",
    );
    expect(docsReadme).toContain("must include a schema or query-key version segment");
    expect(docsReadme).toContain("Generated schema drift becomes a failing gate");
    expect(docsReadme).toContain("Date fixtures must use a frozen clock plus relative offsets");
    expect(docsReadme).toContain("Reproducibility audit policy");
    expect(docsReadme).toContain("must not depend on local app state");
    expect(docsReadme).toContain("Runtime dependencies affect shipped code or native behavior");
    expect(docsReadme).toContain(
      "Build-only dependencies affect compilation, bundling, packaging, or generated assets",
    );
    expect(docsReadme).toContain("Dev-only dependencies affect lint, format, reports, or local-only tooling");
    expect(docsReadme).toContain("Transitive-risk updates are indirect dependency changes");
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
