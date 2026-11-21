import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import {
  extractMarkdownInlineCode,
  extractMarkdownLinks,
  extractMarkdownRelativeLinks,
  extractMiseRunTasks,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "@tests/helpers/repo-contract-parser";
import { describe, expect, it } from "vitest";
import {
  resolveAddFeedInvalidationQueryKeys,
  resolveArticleInvalidationQueryKeys,
  resolveArticleMutationInvalidationQueryKeys,
  resolveDeleteFeedInvalidationQueryKeys,
  resolveFeedInvalidationQueryKeys,
} from "@/lib/query/query-invalidation";
import issueFeatureTemplate from "../../../.github/ISSUE_TEMPLATE/01-feature.yml?raw";
import issueBugTemplate from "../../../.github/ISSUE_TEMPLATE/02-bug.yml?raw";
import issueTestTemplate from "../../../.github/ISSUE_TEMPLATE/03-test-verification.yml?raw";
import issueMaintenanceTemplate from "../../../.github/ISSUE_TEMPLATE/04-maintenance.yml?raw";
import labelerConfig from "../../../.github/labeler.yml?raw";
import releaseNotesConfig from "../../../.github/release.yml?raw";
import storybookConfig from "../../../.storybook/main";
import {
  STORYBOOK_A11Y_TEST_MODE,
  STORYBOOK_A11Y_TEST_TODO_ALLOWLIST,
  STORYBOOK_PREVIEW_BACKGROUND_TOKEN,
  STORYBOOK_PREVIEW_BACKGROUND_VALUES,
  STORYBOOK_PREVIEW_BACKGROUNDS,
} from "../../../.storybook/preview";
import appE2eSpec from "../../../e2e/app.spec.ts?raw";
import runtimeErrorGuardHelper from "../../../e2e/helpers/runtime-error-guard.ts?raw";
import { uiReferenceCanvasStoryIds } from "../../../e2e/storybook/storybook-index-payload";
import packageJson from "../../../package.json";
import { qualityBaselineRepoScanIgnoredPathPrefixes } from "../../../scripts/quality-baseline";
import {
  DEPENDENCY_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_DIR,
} from "../../../scripts/release/lib/release-provenance.ts";
import { parseReleaseSourceInputs } from "../../../scripts/release/lib/release-source-policy.ts";
import { runArtifactWorkflow } from "../../../scripts/release/workflows/artifacts.ts";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import tauriReleaseConfig from "../../../src-tauri/tauri.release.conf.json";
import {
  addFile as addArtifactFixtureFile,
  createFakeArtifactWorkflowIO,
  expectProcessExit,
} from "../../../tests/helpers/artifact-workflow-fixture.ts";
import { SENTRY_INGEST_ORIGIN } from "../../lib/runtime/monitoring";

const repoRoot = process.cwd();
type CapabilityPermission =
  | string
  | {
      identifier: string;
      allow?: Array<{ url: string }>;
      deny?: Array<{ url: string }>;
    };
const defaultCapability: Array<{
  identifier?: string;
  webviews?: string[];
  permissions?: CapabilityPermission[];
}> = JSON.parse(readFileSync(join(repoRoot, "src-tauri/capabilities/default.json"), "utf8"));

function permissionIdentifier(permission: CapabilityPermission): string {
  return typeof permission === "string" ? permission : permission.identifier;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry): entry is string => typeof entry === "string")
  );
}

function expectPackageJsonStringRecord(fieldName: "scripts" | "devDependencies"): Record<string, string> {
  const value = packageJson[fieldName];

  if (!isStringRecord(value)) {
    throw new TypeError(`Expected package.json ${fieldName} to be a string record`);
  }

  return value;
}

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readMigrationModuleSource() {
  return ["mod.rs", "consts.rs", "repairs.rs"]
    .map((file) => readRepoFile(`src-tauri/src/infra/db/migration/${file}`))
    .join("\n");
}

function readMiseTaskCorpus() {
  return ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
    .map(readRepoFile)
    .join("\n");
}

function extractCssCustomProperty(source: string, selector: string, property: string) {
  const selectorMatch = source.match(new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{(?<body>[\\s\\S]*?)\\}`));
  const body = selectorMatch?.groups?.body ?? "";
  return body.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1]?.trim() ?? "";
}

function readDirectoryFileStems(path: string) {
  return readdirSync(join(repoRoot, path))
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => fileName.replace(/\.ts$/, ""))
    .filter((fileName) => fileName !== "index")
    .toSorted();
}

function toPosixPath(path: string) {
  return path.replaceAll("\\", "/");
}

function normalizeRepoPath(path: string) {
  return toPosixPath(normalize(path));
}

function extractSchemaBarrelExportTargets(source: string) {
  return [...source.matchAll(/from "\.\/([^"]+)";/g)]
    .map((match) => match[1])
    .filter(Boolean)
    .toSorted();
}

function extractMiseTaskNames(source: string) {
  const taskNames = new Set<string>();

  for (const match of source.matchAll(/^(?:\[tasks(?:\."([^"]+)"|\.([^\]\s]+))\]|\["([^"\]\n]+)"\])/gm)) {
    taskNames.add(match[1] ?? match[2] ?? match[3]);
  }

  return taskNames;
}

function extractWorkflowJobIds(source: string) {
  const jobsSection = source.match(/^jobs:\n([\s\S]*)$/m)?.[1] ?? "";
  return [...jobsSection.matchAll(/^ {2}([A-Za-z0-9_-]+):$/gm)].map((match) => match[1]);
}

function workflowFilesUnderGithub() {
  return readdirSync(join(repoRoot, ".github/workflows"))
    .filter((entry) => entry.endsWith(".yml"))
    .map((entry) => `.github/workflows/${entry}`)
    .toSorted();
}

function extractTopLevelWorkflowPermissions(source: string) {
  const permissionsSection = source.match(/^permissions:\n((?: {2}[A-Za-z-]+:\s+\S+\n?)+)/m)?.[1] ?? "";
  const permissions = Object.fromEntries(
    [...permissionsSection.matchAll(/^ {2}([A-Za-z-]+):\s+(\S+)$/gm)]
      .map((match) => [match[1] ?? "", match[2] ?? ""])
      .toSorted(([leftPermission], [rightPermission]) => leftPermission.localeCompare(rightPermission)),
  );

  return permissions;
}

function extractTopLevelWorkflowConcurrency(source: string) {
  const concurrencySection = source.match(/^concurrency:\n((?: {2}[A-Za-z-]+:\s+.+\n?)+)/m)?.[1] ?? "";
  return Object.fromEntries(
    [...concurrencySection.matchAll(/^ {2}([A-Za-z-]+):\s+(.+)$/gm)]
      .map((match) => [match[1] ?? "", match[2] ?? ""])
      .toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
}

function extractWorkflowCheckJobIds(source: string) {
  return extractWorkflowJobIds(source).filter((jobId) => {
    const jobSection = source.match(new RegExp(`^  ${jobId}:\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:|$)`, "m"))?.[1] ?? "";
    return /^\s+name:\s+"Check:/.test(jobSection);
  });
}

function extractQualityGateNeeds(source: string) {
  const needsLine = source.match(/^ {2}quality-gate:\n[\s\S]*?^\s+needs:\s+\[([^\]]+)\]/m)?.[1] ?? "";
  return needsLine
    .split(",")
    .flatMap((value) => {
      const trimmedValue = value.trim();
      return trimmedValue ? [trimmedValue] : [];
    })
    .toSorted();
}

function extractMiseTaskSection(source: string, taskName: string) {
  const escapedTaskName = taskName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    source.match(
      new RegExp(
        `^(?:\\[tasks(?:\\."${escapedTaskName}"|\\.${escapedTaskName})\\]|\\["${escapedTaskName}"\\])\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`,
        "m",
      ),
    )?.[1] ?? ""
  );
}

function extractMiseTaskCommand(source: string, taskName: string, commandName: "run" | "run_windows" = "run") {
  return (
    extractMiseTaskSection(source, taskName).match(new RegExp(`^${commandName}\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? null
  );
}

function extractViteServerPort(source: string) {
  return Number(source.match(/\bserver:\s*{[^}]*\bport:\s*(\d+)/s)?.[1] ?? Number.NaN);
}

function extractUrlPort(url: string) {
  return Number(new URL(url).port);
}

function extractStorybookDevCommandPorts(source: string) {
  return [...source.matchAll(/\bstorybook(?:\.ps1)?\s+dev\s+-p\s+(\d+)/g)]
    .map((match) => Number(match[1]))
    .toSorted((left, right) => left - right);
}

function extractPnpmScriptName(command: string) {
  return command.match(/^pnpm\s+([A-Za-z0-9:_-]+)$/)?.[1] ?? "";
}

function extractPlaywrightOutputDir(source: string) {
  return source.match(/\boutputDir:\s*"([^"]+)"/)?.[1] ?? "";
}

function extractPlaywrightHtmlReportFolder(source: string) {
  return source.match(/\boutputFolder:\s*"([^"]+)"/)?.[1] ?? "";
}

function extractPlaywrightForbidOnlyExpression(source: string) {
  return source.match(/\bforbidOnly:\s*([^,\n]+)/)?.[1]?.trim() ?? "";
}

function extractPlaywrightReuseExistingServerExpression(source: string) {
  return source.match(/\breuseExistingServer:\s*(true|false)/)?.[1] ?? "";
}

function extractStorybookCanvasIds(source: string) {
  return [...source.matchAll(/title:\s*"([^"]+)"/g)]
    .map(
      (match) =>
        `${match[1]
          ?.toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}--default`,
    )
    .toSorted();
}

function extractConfigAliases(source: string, configPath: string) {
  const aliases = new Map<string, string>();
  const configDir = dirname(configPath);

  for (const match of source.matchAll(/"([^"]+)":\s*path\.(?:resolve|join)\(import\.meta\.dirname,\s*"([^"]+)"\)/g)) {
    const alias = match[1] ?? "";
    const target = match[2] ?? "";
    aliases.set(alias, normalizeRepoPath(join(configDir, target)));
  }

  return Object.fromEntries([...aliases.entries()].toSorted());
}

function extractCargoPackageField(source: string, field: string) {
  const packageStart = source.indexOf("[package]");
  const nextSection = source.indexOf("\n[", packageStart + "[package]".length);
  const packageSection = source.slice(packageStart, nextSection === -1 ? undefined : nextSection);
  return packageSection.match(new RegExp(`^${field}\\s*=\\s*(["'])([^"']+)\\1`, "m"))?.[2];
}

function extractCargoBinNames(source: string) {
  return [...source.matchAll(/\[\[bin\]\]\s*\n(?:[^\n[][^\n]*\n?)*?name\s*=\s*(["'])([^"']+)\1/g)].map(
    (match) => match[2],
  );
}

type TauriBundleConfig = { bundle?: { externalBin?: string[] } };

function readTauriBundleConfig(path: string): TauriBundleConfig {
  return JSON.parse(readRepoFile(path));
}

function markdownFilesUnderDirectory(path: string) {
  return readdirSync(join(repoRoot, path), { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => toPosixPath(join(path, entry)))
    .filter((filePath) => statSync(join(repoRoot, filePath)).isFile() && filePath.endsWith(".md"));
}

function markdownFilesUnderDocs() {
  const topLevelDocs = ["AGENTS.md", "README.md", ".claude/rules/README.md", "docs/README.md"];
  const commandFiles = markdownFilesUnderDirectory(".claude/commands");
  const codexSkillFiles = markdownFilesUnderDirectory(".codex/skills");
  const docsFiles = markdownFilesUnderDirectory("docs");
  const ruleFiles = markdownFilesUnderDirectory(".claude/rules");

  return [...new Set([...topLevelDocs, ...commandFiles, ...codexSkillFiles, ...docsFiles, ...ruleFiles])].toSorted();
}

function storyFilesUnderSrc() {
  return readdirSync(join(repoRoot, "src"), { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.stories\.(ts|tsx)$/.test(entry))
    .map((entry) => toPosixPath(join("src", entry)))
    .toSorted();
}

function typescriptFilesUnder(paths: readonly string[]) {
  return paths.flatMap((path) => {
    const absolutePath = join(repoRoot, path);
    const stats = statSync(absolutePath);
    if (stats.isFile()) {
      return /\.(?:ts|tsx)$/.test(path) ? [toPosixPath(path)] : [];
    }

    return readdirSync(absolutePath, { recursive: true })
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => toPosixPath(join(path, entry)))
      .filter((filePath) => statSync(join(repoRoot, filePath)).isFile() && /\.(?:ts|tsx)$/.test(filePath));
  });
}

const valibotValidationBoundaryPaths = new Set([
  "src/__tests__/api/browser-webview-command-contract.node.test.ts",
  "src/__tests__/api/command-args-validation.node.test.ts",
  "src/__tests__/api/schema-barrel-public-api.test.ts",
  "src/__tests__/api/schemas.node.test.ts",
  "src/__tests__/api/schemas/database-info.test.ts",
  "src/__tests__/api/schemas/feed-integrity.test.ts",
  "src/__tests__/api/schemas/platform-info.test.ts",
  "src/__tests__/api/schemas/sync-result.test.ts",
  "src/__tests__/api/schemas/update-info.test.ts",
  "src/__tests__/components/article-content-view.test.tsx",
  "src/__tests__/components/settings-preference-option-schema-parity.node.test.tsx",
  "src/__tests__/components/use-data-settings-controller.node.test.ts",
  "src/__tests__/components/use-general-settings-view-props.node.test.ts",
  "src/__tests__/constants/source-of-truth.test.ts",
  "src/__tests__/dev/dev-mock-data.test.ts",
  "src/__tests__/dev/dev-mock-data-demo-en.node.test.ts",
  "src/__tests__/dev/dev-mocks-browser.node.test.ts",
  "src/__tests__/dev/dev-mocks.node.test.ts",
  "src/__tests__/hooks/tag-mute-settings-contract.test.ts",
  "src/__tests__/schemas/package-scripts.test.ts",
  "src/__tests__/schemas/parse.test.ts",
  "src/__tests__/schemas/platform-mock-parity.test.ts",
  "src/__tests__/schemas/preferences-schema-contract.test.ts",
  "src/__tests__/schemas/storage.test.ts",
  "src/__tests__/stores/ui-store.node.test.ts",
  "tests/helpers/app-error.ts",
  "tests/helpers/fixtures.test.ts",
  "tests/helpers/tauri-mocks.node.test.ts",
]);

function isSchemaOwnedValibotImportPath(path: string) {
  return (
    path.startsWith("src/api/schemas/") ||
    path.startsWith("src/schemas/") ||
    valibotValidationBoundaryPaths.has(path) ||
    path === "src/api/tauri-commands/local-account-sync.ts" ||
    path === "src/api/tauri-commands/runtime.ts" ||
    path === "src/api/tauri-commands/system.ts" ||
    path === "src/components/reader/hooks/sidebar/use-sidebar-startup-folder-expansion.ts" ||
    path === "src/components/reader/hooks/sidebar/use-sidebar-sync.ts" ||
    path === "src/components/storybook/ui-reference-navigation-specimens.tsx" ||
    path === "src/dev/intent.ts" ||
    path === "src/dev/mocks.ts" ||
    path === "src/hooks/use-updater.ts" ||
    path === "src/lib/browser/browser-webview-event-payloads.ts" ||
    path === "src/lib/command-palette/command-history-storage.ts" ||
    path === "src/stores/ui-store.ts"
  );
}

function extractStoryFileNamedExports(source: string) {
  return [...source.matchAll(/^\s*export\s+(const|function|class|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => ({
    kind: match[1] ?? "",
    name: match[2] ?? "",
  }));
}

function extractStorybookHelperExportAllowlist(source: string) {
  const allowlistEntries = [...source.matchAll(/storyFilePath:\s*"([^"]+)"[\s\S]*?helperExportName:\s*"([^"]+)"/g)].map(
    (match) => ({
      storyFilePath: match[1] ?? "",
      helperExportName: match[2] ?? "",
    }),
  );

  if (allowlistEntries.length === 0) {
    throw new Error("Expected Storybook helper export allowlist entries");
  }

  return allowlistEntries;
}

function isRepositoryRelativeLink(link: string) {
  return (
    !link.startsWith("http://") && !link.startsWith("https://") && !link.startsWith("mailto:") && !link.startsWith("#")
  );
}

function stripAnchor(link: string) {
  const [path] = link.split("#");
  return decodeURIComponent(path);
}

function migrationVersionsFromFiles() {
  return readdirSync(join(repoRoot, "src-tauri/migrations"))
    .flatMap((entry) => {
      const version = entry.match(/^V(\d+)__.+\.sql$/)?.[1];
      return version ? [Number(version)] : [];
    })
    .toSorted((a, b) => a - b);
}

function extractRustLatestMigrationVersion(source: string) {
  return Number(source.match(/pub const LATEST_VERSION: i32 = (\d+);/)?.[1] ?? Number.NaN);
}

function extractIssueTemplateDefaultLabels(source: string) {
  return extractYamlInlineListValues(source, "labels");
}

function extractIssueTemplateCheckboxLabels(source: string, checkboxId: string) {
  const checkboxStart = source.indexOf(`    id: ${checkboxId}`);
  if (checkboxStart === -1) {
    return [];
  }

  const nextFieldStart = source.indexOf("\n  - type:", checkboxStart + 1);
  const checkboxSection = source.slice(checkboxStart, nextFieldStart === -1 ? undefined : nextFieldStart);
  return [...checkboxSection.matchAll(/^\s+- label:\s*(.+)$/gm)].map((match) => match[1] ?? "");
}

function extractLabelerLabelsForGlob(source: string, glob: string) {
  const labels: string[] = [];
  let currentLabel: string | null = null;

  for (const line of source.split("\n")) {
    const labelMatch = line.match(/^([A-Za-z0-9_/-]+):$/);

    if (labelMatch) {
      currentLabel = labelMatch[1];
      continue;
    }

    if (currentLabel && line.includes(`"${glob}"`)) {
      labels.push(currentLabel);
    }
  }

  return labels;
}

function labelerGlobCoversPath(glob: string, path: string) {
  const escapedGlob = glob
    .replaceAll("**", "__DOUBLE_STAR__")
    .replaceAll(".", "\\.")
    .replaceAll("/", "\\/")
    .replaceAll("*", "[^/]*")
    .replaceAll("__DOUBLE_STAR__", ".*");
  return new RegExp(`^${escapedGlob}$`).test(path);
}

function extractLabelerLabelsForPath(source: string, path: string) {
  const labels = new Set<string>();
  let currentLabel: string | null = null;

  for (const line of source.split("\n")) {
    const labelMatch = line.match(/^([A-Za-z0-9_/-]+):$/);

    if (labelMatch) {
      currentLabel = labelMatch[1];
      continue;
    }

    const glob = line.match(/^\s+- "([^"]+)"$/)?.[1];
    if (currentLabel && glob && labelerGlobCoversPath(glob, path)) {
      labels.add(currentLabel);
    }
  }

  return [...labels].toSorted();
}

function extractLabelerRuleLabels(source: string) {
  return extractYamlTopLevelKeys(source);
}

function extractReleaseNoteCategoryLabels(source: string) {
  const categoriesSection = source.match(/^\s+categories:\n([\s\S]*)$/m)?.[1] ?? "";
  return extractYamlLabelsFields(categoriesSection)
    .filter((label) => label !== "*")
    .toSorted();
}

function extractReleaseNoteExcludedLabels(source: string) {
  const excludeLabelsSection = source.match(/^\s+exclude:\n\s+labels:\n((?:\s+- .+\n)+)/m)?.[1] ?? "";
  return extractYamlInlineListValues(`labels:\n${excludeLabelsSection}`, "labels").toSorted();
}

const issueTemplates = [issueFeatureTemplate, issueBugTemplate, issueTestTemplate, issueMaintenanceTemplate] as const;

const labelerManagedLabels = [
  "frontend",
  "backend",
  "ui",
  "docs",
  "ci",
  "category/tests",
  "maintenance-family",
  "dependencies",
  "i18n",
] as const;
const maintainerManagedLabels = ["manual-verification", "release-readiness", "product", "category/tests"] as const;
const prInsightsManagedLabels = ["risk/*", "size/*"] as const;
const issueTemplateDefaultLabels = ["feature", "fix", "category/tests", "chore"] as const;
const releaseNoteLabelParityLabels = [
  "breaking",
  "chore",
  "dependencies",
  "docs",
  "feature",
  "fix",
  "refactor",
] as const;
const storybookStoryHelperExportAllowlist = new Set(
  extractStorybookHelperExportAllowlist(readRepoFile("tests/helpers/storybook-story-export-registry.ts")).map(
    ({ storyFilePath, helperExportName }) => `${storyFilePath.replace(/^\/+/, "")}:${helperExportName}`,
  ),
);
const maintainerManagedLabelSet = new Set<string>(maintainerManagedLabels);
const automationMaintenanceLabelSet = new Set(["ci", "maintenance-family"]);
const pathLabelableAffectedAreaTemplateNames = ["feature", "bug", "test verification", "maintenance"] as const;
const sharedAutomaticAffectedAreaLabelParity = [
  {
    optionByTemplateName: {
      feature: "ドキュメント",
      bug: "ドキュメント",
      "test verification": "ドキュメント",
      maintenance: "ドキュメント",
    },
    paths: ["docs/README.md"],
    labels: ["docs"],
  },
  {
    optionByTemplateName: {
      feature: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
      bug: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
      "test verification": "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
      maintenance: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
    },
    paths: [".github/workflows/ci.yml", "mise.toml"],
    labels: ["ci", "maintenance-family"],
  },
  {
    optionByTemplateName: {
      feature: "依存関係",
      bug: "依存関係",
      "test verification": "依存関係",
      maintenance: "dependencies",
    },
    paths: ["package.json", "src-tauri/Cargo.toml"],
    labels: ["dependencies"],
  },
  {
    optionByTemplateName: {
      feature: "i18n / ローカライズ",
      bug: "i18n / ローカライズ",
      "test verification": "i18n / ローカライズ",
      maintenance: "i18n / ローカライズ",
    },
    paths: ["src/locales/ja/common.json"],
    labels: ["i18n"],
  },
] as const;
const maintainerManagedAffectedAreas = [
  {
    templateName: "feature",
    template: issueFeatureTemplate,
    options: ["Product / release planning"],
  },
  {
    templateName: "test verification",
    template: issueTestTemplate,
    options: ["updater / release flow"],
  },
  {
    templateName: "maintenance",
    template: issueMaintenanceTemplate,
    options: ["リリース運用", "Product / go-to-market", "実機確認"],
  },
] as const;
const automaticAffectedAreaLabelParity = [
  {
    templateName: "feature",
    template: issueFeatureTemplate,
    entries: [
      {
        option: "ドキュメント",
        paths: ["docs/README.md"],
        labels: ["docs"],
      },
      {
        option: "CI/CD",
        paths: [".github/workflows/ci.yml"],
        labels: ["ci"],
      },
      {
        option: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
        paths: [".github/workflows/ci.yml", "mise.toml"],
        labels: ["ci", "maintenance-family"],
      },
      {
        option: "依存関係",
        paths: ["package.json", "src-tauri/Cargo.toml"],
        labels: ["dependencies"],
      },
      {
        option: "i18n / ローカライズ",
        paths: ["src/locales/ja/common.json"],
        labels: ["i18n"],
      },
    ],
  },
  {
    templateName: "bug",
    template: issueBugTemplate,
    entries: [
      {
        option: "ドキュメント",
        paths: ["docs/README.md"],
        labels: ["docs"],
      },
      {
        option: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
        paths: [".github/workflows/ci.yml", "mise.toml"],
        labels: ["ci", "maintenance-family"],
      },
      {
        option: "依存関係",
        paths: ["package.json", "src-tauri/Cargo.toml"],
        labels: ["dependencies"],
      },
      {
        option: "i18n / ローカライズ",
        paths: ["src/locales/ja/common.json"],
        labels: ["i18n"],
      },
    ],
  },
  {
    templateName: "test verification",
    template: issueTestTemplate,
    entries: [
      {
        option: "CI/CD",
        paths: [".github/workflows/ci.yml"],
        labels: ["ci"],
      },
      {
        option: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
        paths: [".github/workflows/ci.yml", "mise.toml"],
        labels: ["ci", "maintenance-family"],
      },
      {
        option: "ドキュメント",
        paths: ["docs/README.md"],
        labels: ["docs"],
      },
      {
        option: "依存関係",
        paths: ["package.json", "src-tauri/Cargo.toml"],
        labels: ["dependencies"],
      },
      {
        option: "i18n / ローカライズ",
        paths: ["src/locales/ja/common.json"],
        labels: ["i18n"],
      },
    ],
  },
  {
    templateName: "maintenance",
    template: issueMaintenanceTemplate,
    entries: [
      {
        option: "dependencies",
        paths: ["package.json", "src-tauri/Cargo.toml"],
        labels: ["dependencies"],
      },
      {
        option: "CI/CD",
        paths: [".github/workflows/ci.yml"],
        labels: ["ci"],
      },
      {
        option: "ワークフロー / 設定 (GitHub Actions / mise / tooling)",
        paths: [".github/workflows/ci.yml", "mise.toml"],
        labels: ["ci", "maintenance-family"],
      },
      {
        option: "ドキュメント",
        paths: ["docs/README.md"],
        labels: ["docs"],
      },
      {
        option: "i18n / ローカライズ",
        paths: ["src/locales/ja/common.json"],
        labels: ["i18n"],
      },
    ],
  },
] as const;

describe("repository static contracts", () => {
  it("keeps query invalidation target matrices covering every non-account query root", () => {
    const invalidationTargetRoots = [
      ...resolveFeedInvalidationQueryKeys({
        includeAccountUnreadCount: true,
        includeLocalFeedSyncStatuses: true,
        includeRemoteFeedSyncStatuses: true,
      }),
      ...resolveArticleInvalidationQueryKeys({
        includeTagArticleCounts: true,
        includeFeedIntegrityReport: true,
      }),
    ];
    const mutationTargetRoots = [
      ...resolveArticleMutationInvalidationQueryKeys("article-read"),
      ...resolveArticleMutationInvalidationQueryKeys("article-star"),
      ...resolveArticleMutationInvalidationQueryKeys("mute-keyword"),
      ...resolveArticleMutationInvalidationQueryKeys("tag-article-assignment"),
      ...resolveArticleMutationInvalidationQueryKeys("tag-metadata"),
      ...resolveAddFeedInvalidationQueryKeys({ accountId: "acc-1" }),
      ...resolveDeleteFeedInvalidationQueryKeys({ accountId: "acc-1" }),
    ];
    const reachableRootNames = new Set(
      [...invalidationTargetRoots, ...mutationTargetRoots].map((queryKey) => queryKey[1]),
    );

    expect([...reachableRootNames].toSorted()).toEqual([
      "accountArticles",
      "accountStarredCount",
      "accountUnreadCount",
      "articles",
      "articlesByTag",
      "feedArticleSummaries",
      "feedIntegrityReport",
      "feeds",
      "folderArticles",
      "folders",
      "localFeedSyncStatuses",
      "recentArticles",
      "remoteFeedSyncStatuses",
      "search",
      "starredArticles",
      "tagArticleCounts",
    ]);
  });

  it("keeps markdown format and lint tasks on the same glob inventory", () => {
    const miseSource = readMiseTaskCorpus();

    for (const commandName of ["run", "run_windows"] as const) {
      const lintCommand = extractMiseTaskCommand(miseSource, "lint:md", commandName);
      const formatCommand = extractMiseTaskCommand(miseSource, "format:md", commandName);

      expect(formatCommand).toBe(`${lintCommand} --fix`);
    }
  });

  it("keeps API schema files covered by barrel exports and schema tests", () => {
    const schemaFileStems = readDirectoryFileStems("src/api/schemas").filter((stem) => stem !== "validation");
    const schemaBarrelExportTargets = extractSchemaBarrelExportTargets(readRepoFile("src/api/schemas/index.ts"));
    const dedicatedSchemaTestStems = readDirectoryFileStems("src/__tests__/api/schemas").map((fileName) =>
      fileName.replace(/\.test$/, ""),
    );
    const aggregateSchemaTestSource = readRepoFile("src/__tests__/api/schema-barrel-public-api.test.ts");

    expect(schemaBarrelExportTargets).toEqual(schemaFileStems);

    for (const schemaFileStem of schemaFileStems) {
      const hasDedicatedTest = dedicatedSchemaTestStems.includes(schemaFileStem);
      const hasAggregateCoverage = aggregateSchemaTestSource.includes(`"${schemaFileStem}"`);

      expect(hasDedicatedTest || hasAggregateCoverage, `${schemaFileStem} must have schema test coverage`).toBe(true);
    }
  });

  it("keeps generated schema and target artifacts outside repo scan inventories", () => {
    const gitignoreSource = readRepoFile(".gitignore");
    const ripgrepIgnoreSource = readRepoFile(".ignore");
    const miseSource = readMiseTaskCorpus();
    const ignoredArtifactPrefixes = [
      "dist/",
      "src-tauri/target/",
      "tmp/",
      "storybook-static/",
      "test-results/",
      "playwright-report/",
      "src-tauri/gen/schemas/",
    ] as const;

    for (const ignoredArtifactPrefix of ignoredArtifactPrefixes) {
      expect(gitignoreSource).toContain(ignoredArtifactPrefix);
      expect(ripgrepIgnoreSource).toContain(ignoredArtifactPrefix);
      expect(qualityBaselineRepoScanIgnoredPathPrefixes).toContain(ignoredArtifactPrefix);
    }

    expect(extractMiseTaskCommand(miseSource, "lint:md")).toContain("$MD_EXCLUDE_TARGET");
    expect(extractMiseTaskCommand(miseSource, "lint:md")).toContain("$MD_EXCLUDE_TAURI_GEN");
    expect(extractMiseTaskCommand(miseSource, "quality:markdownlint-contract")).toContain("$MD_EXCLUDE_TARGET");
    expect(extractMiseTaskCommand(miseSource, "quality:markdownlint-contract")).toContain("$MD_EXCLUDE_TAURI_GEN");
  });

  it("keeps app E2E Playwright and package dev scripts aligned with the Vite port", () => {
    const playwrightConfig = readRepoFile("playwright.config.ts");
    const viteConfig = readRepoFile("vite.config.ts");
    const vitePort = extractViteServerPort(viteConfig);
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const playwrightBaseUrl = playwrightConfig.match(/\bbaseURL:\s*"([^"]+)"/)?.[1] ?? "";
    const playwrightWebServerCommand = playwrightConfig.match(/\bcommand:\s*"([^"]+)"/)?.[1] ?? "";
    const playwrightWebServerUrl = playwrightConfig.match(/\bwebServer:\s*{[^}]*\burl:\s*"([^"]+)"/s)?.[1] ?? "";

    expect(playwrightWebServerCommand).toBe("pnpm dev:tauri:vite");
    expect(packageScripts[extractPnpmScriptName(playwrightWebServerCommand)]).toBe(packageScripts["dev:tauri:vite"]);
    expect(readRepoFile("scripts/tauri-dev-vite-manager.ts")).toContain("classifyPortOwnerCommandLine");
    expect(extractPlaywrightReuseExistingServerExpression(playwrightConfig)).toBe("false");
    expect(viteConfig).toContain("strictPort: true");
    expect(extractUrlPort(playwrightBaseUrl)).toBe(vitePort);
    expect(playwrightWebServerUrl).toBe(playwrightBaseUrl);
  });

  it("keeps app E2E tests covered by the runtime error guard", () => {
    const runtimeGuardImports = [
      "disposeRuntimeErrorGuard",
      "expectNoRuntimeErrors",
      "installAppRuntimeErrorGuard",
    ] as const;

    for (const importedName of runtimeGuardImports) {
      expect(appE2eSpec).toContain(importedName);
      expect(runtimeErrorGuardHelper).toContain(`function ${importedName}`);
    }
  });

  it("keeps app and Storybook Playwright artifacts separated", () => {
    const playwrightConfig = readRepoFile("playwright.config.ts");
    const storybookPlaywrightConfig = readRepoFile("playwright.storybook.config.ts");
    const appOutputDir = extractPlaywrightOutputDir(playwrightConfig);
    const storybookOutputDir = extractPlaywrightOutputDir(storybookPlaywrightConfig);
    const appReportFolder = extractPlaywrightHtmlReportFolder(playwrightConfig);
    const storybookReportFolder = extractPlaywrightHtmlReportFolder(storybookPlaywrightConfig);

    expect(appOutputDir).not.toBe(storybookOutputDir);
    expect(appReportFolder).not.toBe(storybookReportFolder);
  });

  it("isolates the static accessibility suite from dev-server Playwright runs", () => {
    const auditConfig = readRepoFile("playwright.storybook-a11y.config.ts");
    expect(extractPlaywrightForbidOnlyExpression(auditConfig)).toBe("Boolean(process.env.CI)");
    expect(auditConfig).toContain("reuseExistingServer: false");
    for (const config of ["playwright.config.ts", "playwright.storybook.config.ts"])
      expect(readRepoFile(config)).toMatch(/testIgnore: "[^" ]*accessibility\.spec\.ts"/);
  });

  it("keeps app and Storybook Playwright focused tests forbidden in CI", () => {
    const playwrightConfig = readRepoFile("playwright.config.ts");
    const storybookPlaywrightConfig = readRepoFile("playwright.storybook.config.ts");

    expect(extractPlaywrightForbidOnlyExpression(playwrightConfig)).toBe("Boolean(process.env.CI)");
    expect(extractPlaywrightForbidOnlyExpression(storybookPlaywrightConfig)).toBe("Boolean(process.env.CI)");
  });

  it("keeps CI mise tasks resolvable", () => {
    const miseTasks = extractMiseTaskNames(readMiseTaskCorpus());
    const ciTasks = extractMiseRunTasks(readRepoFile(".github/workflows/ci.yml"));

    expect(ciTasks.filter((task) => !miseTasks.has(task))).toEqual([]);
  });

  it("keeps CI quality gate waiting on every check job", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(extractWorkflowJobIds(ciWorkflow)).toContain("change-plan");
    expect(extractQualityGateNeeds(ciWorkflow)).toEqual(
      ["change-plan", ...extractWorkflowCheckJobIds(ciWorkflow)].toSorted(),
    );
  });

  it("keeps Storybook addons and framework backed by dev dependencies", () => {
    const devDependencies = expectPackageJsonStringRecord("devDependencies");
    const addons = storybookConfig.addons ?? [];
    const addonNames = addons.map((addon) => (typeof addon === "string" ? addon : addon.name));
    const framework =
      typeof storybookConfig.framework === "string" ? storybookConfig.framework : storybookConfig.framework?.name;

    expect(
      [...addonNames, framework].filter((name): name is string => Boolean(name) && !(name in devDependencies)),
    ).toEqual([]);
  });

  it("keeps Storybook a11y addon violations gated with an explicit allowlist", () => {
    const storySourcesWithA11yTodo = storyFilesUnderSrc().filter((filePath) => {
      const source = readRepoFile(filePath);
      return /a11y\s*:\s*\{[^}]*test\s*:\s*["'](?:todo|off)["']/s.test(source);
    });

    expect(STORYBOOK_A11Y_TEST_MODE).toBe("error");
    expect(storybookConfig.addons).toContain("@storybook/addon-a11y");
    expect(storySourcesWithA11yTodo).toEqual([...STORYBOOK_A11Y_TEST_TODO_ALLOWLIST]);
  });

  it("keeps Storybook preview backgrounds aligned with CSS theme canvas tokens", () => {
    const globalCss = readRepoFile("src/styles/global.css");
    const previewBackgroundsByName = new Map(
      STORYBOOK_PREVIEW_BACKGROUNDS.map(({ name, value }) => [name, value] as const),
    );

    expect(STORYBOOK_PREVIEW_BACKGROUND_VALUES).toEqual({
      dark: extractCssCustomProperty(globalCss, ":root.dark", STORYBOOK_PREVIEW_BACKGROUND_TOKEN),
      light: extractCssCustomProperty(globalCss, ":root", STORYBOOK_PREVIEW_BACKGROUND_TOKEN),
    });
    expect(previewBackgroundsByName).toEqual(
      new Map([
        ["dark", STORYBOOK_PREVIEW_BACKGROUND_VALUES.dark],
        ["light", STORYBOOK_PREVIEW_BACKGROUND_VALUES.light],
      ]),
    );
  });

  it("keeps UI design rules aligned with shared CSS color tokens", () => {
    const designGuidance = readRepoFile("DESIGN.md");
    const colorRule = readRepoFile(".claude/rules/color-pattern.md");
    const globalCss = readRepoFile("src/styles/global.css");

    // DESIGN.md documents each fixed role as "- <Role> (`#rrggbb`)". Extract the
    // documented values and compare the CSS token layer against them instead of
    // restating the hex literals here.
    const designRoleColors = new Map<string, Set<string>>();
    for (const match of designGuidance.matchAll(
      /- (Primary|Secondary|Unread|Loading|Starred) \(`?(#[0-9a-f]{6})`?\)/g,
    )) {
      const role = match[1] ?? "";
      const values = designRoleColors.get(role) ?? new Set<string>();
      values.add(match[2] ?? "");
      designRoleColors.set(role, values);
    }
    const designRoleColor = (role: string): string => {
      const values = designRoleColors.get(role) ?? new Set<string>();
      expect(values.size, `DESIGN.md should document one ${role} color`).toBe(1);
      return [...values][0] ?? "";
    };
    const primary = designRoleColor("Primary");
    const secondary = designRoleColor("Secondary");
    const unread = designRoleColor("Unread");
    const starred = designRoleColor("Starred");

    expect(designRoleColor("Loading")).toBe(unread);
    expect(designGuidance).toContain("Dialog and Popup Shells");
    expect(designGuidance).toContain("named scrim roles from the token layer");

    for (const scope of [":root", ":root.dark"] as const) {
      expect(extractCssCustomProperty(globalCss, scope, "--theme-primary")).toBe(primary);
      expect(extractCssCustomProperty(globalCss, scope, "--theme-unread")).toBe(unread);
      expect(extractCssCustomProperty(globalCss, scope, "--theme-starred")).toBe(starred);
      expect(extractCssCustomProperty(globalCss, scope, "--control-active-warm")).toBe(secondary);
      expect(extractCssCustomProperty(globalCss, scope, "--tone-loading")).toBe("var(--theme-unread)");
      expect(extractCssCustomProperty(globalCss, scope, "--dialog-scrim")).toBe("var(--dialog-overlay)");
    }
    expect(extractCssCustomProperty(globalCss, ":root", "--gradient-switch-track-on")).toBe(
      "var(--control-active-warm)",
    );
    expect(extractCssCustomProperty(globalCss, ":root", "--gradient-switch-track-off")).toBe("var(--color-input)");

    // color-pattern.md states the focus ring as rgba() of the primary color in
    // light and dark alphas; derive the components from the documented primary.
    const [red, green, blue] = [1, 3, 5].map((index) => Number.parseInt(primary.slice(index, index + 2), 16));
    const primaryRgbaPattern = new RegExp(`rgba\\(${red}, ${green}, ${blue}, [\\d.]+\\)`, "g");
    expect(colorRule.match(primaryRgbaPattern)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(colorRule).toContain("var(--gradient-switch-track-off)");
    expect(colorRule).not.toContain("oklch(0.65 0.15 250)");
  });

  it("keeps Storybook, Vite, and Vitest aliases aligned", () => {
    const expectedAliases = {
      "@": "src",
      "@tests": "tests",
    };

    expect(extractConfigAliases(readRepoFile(".storybook/main.ts"), ".storybook/main.ts")).toEqual(expectedAliases);
    expect(extractConfigAliases(readRepoFile("vite.config.ts"), "vite.config.ts")).toEqual(expectedAliases);
    expect(extractConfigAliases(readRepoFile("vitest.config.ts"), "vitest.config.ts")).toEqual(expectedAliases);
  });

  it("keeps Storybook story named exports limited to stories or allowlisted helpers", () => {
    const storyExportNamePattern = /^[A-Z][A-Za-z0-9]*$/;
    const invalidExports = storyFilesUnderSrc().flatMap((filePath) =>
      extractStoryFileNamedExports(readRepoFile(filePath)).flatMap(({ kind, name }) => {
        const exportKey = `${filePath}:${name}`;
        const isStoryExport = kind === "const" && storyExportNamePattern.test(name);
        const isAllowlistedHelper = storybookStoryHelperExportAllowlist.has(exportKey);

        return isStoryExport || isAllowlistedHelper ? [] : [exportKey];
      }),
    );

    expect(invalidExports).toEqual([]);
  });

  it("keeps Storybook E2E port and UI reference iframe registry aligned", () => {
    const storybookPlaywrightConfig = readRepoFile("playwright.storybook.config.ts");
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const storybookBaseUrl = storybookPlaywrightConfig.match(/\bbaseURL:\s*"([^"]+)"/)?.[1] ?? "";
    const storybookWebServerCommand =
      storybookPlaywrightConfig.match(/\bconst storybookCommand =[\s\S]*?:\s*"([^"]+)";/)?.[1] ?? "";
    const storybookWebServerUrl =
      storybookPlaywrightConfig.match(/\bwebServer:\s*{[^}]*\burl:\s*"([^"]+)"/s)?.[1] ?? "";
    const storybookReuseExistingServer =
      storybookPlaywrightConfig.match(/\breuseExistingServer:\s*(true|false)/)?.[1] ?? "";
    const storybookPort = extractUrlPort(storybookBaseUrl);
    const storySources = readdirSync(join(repoRoot, "src/components/storybook"))
      .filter((entry) => /^ui-reference-.+\.stories\.tsx$/.test(entry))
      .map((entry) => readRepoFile(join("src/components/storybook", entry)));

    expect(storybookPlaywrightConfig).toContain("const storybookCommand = isWindows");
    expect(storybookPlaywrightConfig).toContain(': "pnpm storybook"');
    expect(extractStorybookDevCommandPorts([storybookPlaywrightConfig, packageScripts.storybook].join("\n"))).toEqual([
      storybookPort,
      storybookPort,
    ]);
    expect(packageScripts[extractPnpmScriptName(storybookWebServerCommand)]).toBe(packageScripts.storybook);
    expect(storybookWebServerUrl).toBe(storybookBaseUrl);
    expect(extractUrlPort(storybookWebServerUrl)).toBe(storybookPort);
    expect(storybookReuseExistingServer).toBe("false");
    expect([...uiReferenceCanvasStoryIds].toSorted()).toEqual(
      storySources.flatMap(extractStorybookCanvasIds).toSorted(),
    );
  });

  it("keeps repository-relative documentation links pointing at existing files", () => {
    const ruleMarkdownFiles = readdirSync(join(repoRoot, ".claude/rules"))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => normalizeRepoPath(join(".claude/rules", entry)))
      .toSorted();

    expect(markdownFilesUnderDocs()).toEqual(expect.arrayContaining(ruleMarkdownFiles));
    expect(markdownFilesUnderDocs()).toEqual(
      expect.arrayContaining([".claude/commands/release.md", ".codex/skills/release/SKILL.md"]),
    );

    const brokenLinks = markdownFilesUnderDocs().flatMap((filePath) => {
      const source = readRepoFile(filePath);
      return extractMarkdownLinks(source)
        .filter(isRepositoryRelativeLink)
        .map(stripAnchor)
        .filter((link) => link.length > 0)
        .flatMap((link) => {
          const target = normalize(resolve(repoRoot, dirname(filePath), link));
          return target.startsWith(repoRoot) && existsSync(target) ? [] : [`${filePath} -> ${link}`];
        });
    });

    expect(brokenLinks).toEqual([]);
  });

  it("keeps agent-facing docs independent from machine-local external skill paths", () => {
    const localSkillPathReferences = markdownFilesUnderDocs().flatMap((filePath) => {
      const source = readRepoFile(filePath);
      return source.includes(".agents/skills") ? [filePath] : [];
    });

    expect(localSkillPathReferences).toEqual([]);
  });

  it("keeps the .claude/rules index complete for every project rule", () => {
    const ruleIndex = readRepoFile(".claude/rules/README.md");
    const indexedRuleLinks = new Set(extractMarkdownRelativeLinks(ruleIndex).map((link) => normalizeRepoPath(link)));
    const ruleFiles = readdirSync(join(repoRoot, ".claude/rules"))
      .filter((entry) => entry.endsWith(".md") && entry !== "README.md")
      .map((entry) => normalizeRepoPath(`./${entry}`))
      .toSorted();
    const missingRuleLinks = ruleFiles.filter((ruleFile) => !indexedRuleLinks.has(ruleFile));

    expect(missingRuleLinks).toEqual([]);
    expect(readRepoFile("AGENTS.md")).toContain("[.claude/rules/README.md](.claude/rules/README.md)");
  });

  it("keeps AGENTS rule links aligned with the rules index", () => {
    const claudeGuidance = readRepoFile("AGENTS.md");
    const ruleIndex = readRepoFile(".claude/rules/README.md");
    const indexedRuleFiles = new Set(
      extractMarkdownRelativeLinks(ruleIndex)
        .filter((link) => link.endsWith(".md") && link !== "./README.md")
        .map((link) => normalizeRepoPath(join(".claude/rules", link))),
    );
    const claudeRuleLinks = [
      ...new Set(
        extractMarkdownLinks(claudeGuidance)
          .filter((link) => link.startsWith(".claude/rules/") && link.endsWith(".md"))
          .map((link) => normalizeRepoPath(link)),
      ),
    ].toSorted();
    const missingFromIndex = claudeRuleLinks
      .filter((link) => link !== ".claude/rules/README.md")
      .filter((link) => !indexedRuleFiles.has(link));

    expect(missingFromIndex).toEqual([]);
  });

  it("keeps release workflow permissions and signing secret preflight visible", () => {
    const releaseWorkflow = readRepoFile(".github/workflows/release.yml");
    const signingKeyExpression = "$" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY }}";
    const signingPasswordExpression = "$" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}";
    const unqualifiedWorkflowDispatchReleaseRefExpression =
      "$" + "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref }}";
    const workflowDispatchReleaseNameExpression =
      "$" + "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}";
    const releasePreflightIndex = releaseWorkflow.indexOf("Run release quality preflight");
    const importAppleCertificateIndex = releaseWorkflow.indexOf("Import Apple signing certificate");
    const tauriActionIndex = releaseWorkflow.indexOf("uses: tauri-apps/tauri-action@");
    const validateMacosSigningIndex = releaseWorkflow.indexOf("Validate macOS app signing");

    expect(releaseWorkflow).toContain('tags: ["v*"]');
    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("contents: write");
    expect(releaseWorkflow).toContain("release_tag:");
    expect(releaseWorkflow).toContain("required: true");
    expect(releaseWorkflow).toContain("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
    expect(releaseWorkflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(releaseWorkflow).toContain(["ref: $", "{{ github.ref }}"].join(""));
    expect(releaseWorkflow).not.toContain(`ref: ${unqualifiedWorkflowDispatchReleaseRefExpression}`);
    expect(releasePreflightIndex).toBeGreaterThanOrEqual(0);
    expect(importAppleCertificateIndex).toBeGreaterThanOrEqual(0);
    expect(tauriActionIndex).toBeGreaterThanOrEqual(0);
    expect(validateMacosSigningIndex).toBeGreaterThanOrEqual(0);
    expect(releasePreflightIndex).toBeLessThan(tauriActionIndex);
    expect(importAppleCertificateIndex).toBeLessThan(tauriActionIndex);
    expect(tauriActionIndex).toBeLessThan(validateMacosSigningIndex);
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY: ${signingKeyExpression}`);
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${signingPasswordExpression}`);
    expect(releaseWorkflow).toContain("building macOS artifacts with ad-hoc signing");
    expect(releaseWorkflow).not.toContain('missing+=("APPLE_CERTIFICATE")');
    expect(releaseWorkflow).not.toContain('missing+=("APPLE_SIGNING_IDENTITY")');
    expect(releaseWorkflow).toContain("APPLE_SIGNING_IDENTITY: $" + "{{ secrets.APPLE_SIGNING_IDENTITY }}");
    expect(releaseWorkflow).toContain("APPLE_ID: $" + "{{ secrets.APPLE_ID }}");
    expect(releaseWorkflow).toContain("APPLE_PASSWORD: $" + "{{ secrets.APPLE_PASSWORD }}");
    expect(releaseWorkflow).toContain("APPLE_TEAM_ID: $" + "{{ secrets.APPLE_TEAM_ID }}");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts validate-macos-app-signature");
    expect(releaseWorkflow).toContain(`tagName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain(`releaseName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
    expect(releaseWorkflow).toContain("matrix.updater_enabled == true");
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriReleaseConfig.bundle.macOS?.signingIdentity).toBe("-");
  });

  it("declares Cargo default-run for the app binary because more than one [[bin]] exists", () => {
    const cargoToml = readRepoFile("src-tauri/Cargo.toml");
    const binNames = extractCargoBinNames(cargoToml);

    expect(binNames.length).toBeGreaterThan(1);
    expect(extractCargoPackageField(cargoToml, "default-run")).toBe(extractCargoPackageField(cargoToml, "name"));
  });

  it("keeps no Tauri config externalBin entry duplicating a Cargo [[bin]] name", () => {
    const cargoToml = readRepoFile("src-tauri/Cargo.toml");
    const binNames = extractCargoBinNames(cargoToml);
    const configPaths = [
      "src-tauri/tauri.conf.json",
      "src-tauri/tauri.dev.conf.json",
      "src-tauri/tauri.release.conf.json",
      "src-tauri/tauri.linux.release.conf.json",
    ].filter((configPath) => existsSync(join(repoRoot, configPath)));

    for (const configPath of configPaths) {
      const config = readTauriBundleConfig(configPath);
      for (const externalBin of config.bundle?.externalBin ?? []) {
        expect(binNames).not.toContain(externalBin.split("/").pop());
      }
    }
  });

  it("does not stage the urr CLI as a release sidecar binary", () => {
    const releaseWorkflow = readRepoFile(".github/workflows/release.yml");

    expect(releaseWorkflow).not.toContain("Stage urr CLI sidecar binary");
    expect(releaseWorkflow).not.toContain("scripts/release/stage-cli-sidecar.ts");
    expect(existsSync(join(repoRoot, "scripts/release/stage-cli-sidecar.ts"))).toBe(false);
  });

  it("keeps release provenance uploads recoverable after partial asset failures", () => {
    const tag = "v0.66.0";
    const provenanceAssets = [
      `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-darwin-aarch64.json`,
      `${RELEASE_PROVENANCE_DIR}/cargo-licenses-darwin-aarch64.json`,
      `${RELEASE_PROVENANCE_DIR}/release-provenance-darwin-aarch64.json`,
    ];
    const assetNames = provenanceAssets.map((asset) => asset.split("/").at(-1) ?? asset);
    const releaseView = (names: readonly string[]) =>
      JSON.stringify({
        assets: names.map((name) => ({ name })),
        isDraft: true,
        isPrerelease: false,
        tagName: tag,
        url: `https://github.com/fixture/ultra-rss-reader/releases/tag/${tag}`,
      });
    const fake = createFakeArtifactWorkflowIO();
    addArtifactFixtureFile(fake, DEPENDENCY_PROVENANCE_ASSETS_LIST, `${provenanceAssets.slice(0, 2).join("\n")}\n`);
    addArtifactFixtureFile(fake, RELEASE_PROVENANCE_ASSETS_LIST, `${provenanceAssets[2]}\n`);
    fake.releaseViews.push(
      { status: 0, stderr: "", stdout: releaseView([assetNames[0] ?? ""]) },
      { status: 0, stderr: "", stdout: releaseView([assetNames[0] ?? "", assetNames[1] ?? ""]) },
    );
    fake.uploadResults.push({ status: 1 });

    const exitStatus = expectProcessExit(() =>
      runArtifactWorkflow("upload-release-provenance", { RELEASE_TAG: tag }, fake.io),
    );

    expect(exitStatus).toBe(1);
    expect(fake.events).toEqual([`view:${tag}`, `upload:${tag}`, `view:${tag}`]);
    expect(fake.uploads).toEqual([{ assets: provenanceAssets, tag }]);
    expect(fake.logs[0]).toContain(`clobber_targets=${assetNames[0]} missing_assets=${assetNames[1]},${assetNames[2]}`);
    expect(fake.logs[1]).toContain("provenance upload failure recovery");
    expect(fake.logs[1]).toContain(`clobber_targets=${assetNames[0]},${assetNames[1]} missing_assets=${assetNames[2]}`);
  });

  it("allows the embedded browser child webview to invoke its native commands", () => {
    const capabilities = defaultCapability as Array<{
      identifier?: string;
      permissions?: CapabilityPermission[];
      webviews?: string[];
    }>;
    const mainCapability = capabilities.find((capability) => capability.identifier === "main");
    const browserWebviewCapability = capabilities.find((capability) => capability.identifier === "browser-webview");

    expect(mainCapability?.webviews).toEqual(["main"]);
    expect(browserWebviewCapability?.webviews).toEqual(["browser-webview"]);
    expect(mainCapability?.permissions).toEqual(
      expect.arrayContaining([
        "core:default",
        "core:window:allow-center",
        "core:window:allow-is-fullscreen",
        "core:window:allow-set-size",
      ]),
    );
    expect(mainCapability?.permissions?.map(permissionIdentifier)).not.toContain("opener:allow-default-urls");
    expect(mainCapability?.permissions).toContainEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: "http://*" }, { url: "https://*" }, { url: "mailto:*" }],
    });
    expect(tauriConfig.app.security.csp).toContain(`connect-src ipc: http://ipc.localhost ${SENTRY_INGEST_ORIGIN}`);
    expect(tauriConfig.app.security.csp).toContain("base-uri 'self'");
    expect(tauriConfig.app.security.csp).toContain("form-action 'none'");
    expect(tauriConfig.app.security.csp).toContain("object-src 'none'");
  });

  it("allows Sentry event ingest from the packaged app CSP", () => {
    const tauriConfig = JSON.parse(readRepoFile("src-tauri/tauri.conf.json"));
    const connectSrcDirective = tauriConfig.app.security.csp
      .split(";")
      .map((directive: string) => directive.trim())
      .find((directive: string) => directive.startsWith("connect-src"));

    expect(connectSrcDirective).toBeDefined();
    expect(connectSrcDirective.split(/\s+/)).toContain(SENTRY_INGEST_ORIGIN);
    expect(connectSrcDirective).not.toContain("*");
  });

  it("uses the native Windows URL opener for percent-encoded article links", () => {
    const cargoToml = readRepoFile("src-tauri/Cargo.toml");

    expect(cargoToml).not.toContain('features = ["insecure"]');
  });

  it("keeps Web Preview ATS relaxation scoped to web content loads", () => {
    const infoPlist = readRepoFile("src-tauri/Info.plist");

    expect("infoPlist" in tauriReleaseConfig.bundle.macOS).toBe(false);
    expect(infoPlist).not.toContain("<key>NSAllowsArbitraryLoads</key>");
  });

  it("keeps manual release dispatch pinned to explicit version tags", () => {
    const releaseWorkflow = readRepoFile(".github/workflows/release.yml");
    const workflowDispatchReleaseNameExpression =
      "$" + "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}";

    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("release_tag:");
    expect(releaseWorkflow).toContain("required: true");
    expect(releaseWorkflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(releaseWorkflow).toContain(["ref: $", "{{ github.ref }}"].join(""));
    expect(releaseWorkflow).not.toContain("format('refs/tags/{0}', inputs.release_tag)");
    expect(releaseWorkflow).toContain("name: Validate release source");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-source.ts");
    const releaseTag = "v0.66.0-rc.2+build.4";
    const validInputs = {
      EVENT_NAME: "push",
      RELEASE_TAG: releaseTag,
      WORKFLOW_REF: `refs/tags/${releaseTag}`,
      WORKFLOW_REF_NAME: releaseTag,
    };
    expect(parseReleaseSourceInputs(validInputs)).toMatchObject({
      eventName: "push",
      releaseTag,
      reuseExistingAssets: false,
    });
    expect(() => parseReleaseSourceInputs({ ...validInputs, RELEASE_TAG: "v0.66" })).toThrow(
      "release tag must match vX.Y.Z, optionally with prerelease or build metadata",
    );
    expect(() =>
      parseReleaseSourceInputs({
        ...validInputs,
        RELEASE_TAG: "v0.66.1",
      }),
    ).toThrow(`tag push ref refs/tags/${releaseTag} does not match release tag v0.66.1`);
    expect(releaseWorkflow).toContain(`tagName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain(`releaseName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).not.toContain("github.event_name == 'workflow_dispatch' && github.ref");
    expect(releaseWorkflow).not.toContain("github.event_name == 'workflow_dispatch' && github.ref_name");
  });

  it("keeps bundled app icon provenance and configured icon outputs explicit", () => {
    const docsReadme = readRepoFile("docs/README.md");
    const bundleIcons = tauriConfig.bundle.icon;
    const liquidIconFiles = [
      "assets/app-icon-liquid-foreground.png",
      "assets/app-icon-liquid-v2.png",
      "src-tauri/icons/AppIcon.icon/icon.json",
      "src-tauri/icons/AppIcon.icon/Assets/foreground.png",
      "src-tauri/icons/Assets.car",
    ];

    for (const iconPath of bundleIcons) {
      expect(existsSync(join(repoRoot, "src-tauri", iconPath)), iconPath).toBe(true);
    }
    expect(existsSync(join(repoRoot, "assets/app-icon.png"))).toBe(true);
    expect(existsSync(join(repoRoot, "assets/app-icon-light.png"))).toBe(true);
    expect(existsSync(join(repoRoot, "assets/app-icon-tauri-source.png"))).toBe(true);
    expect(existsSync(join(repoRoot, "src-tauri/icons/icon.png"))).toBe(true);
    for (const iconPath of liquidIconFiles) {
      expect(existsSync(join(repoRoot, iconPath)), iconPath).toBe(true);
    }
    expect(docsReadme).toContain("Bundled app icon provenance");
  });

  it("keeps top-level workflow permissions on a least-privilege inventory", () => {
    const workflowPermissions = workflowFilesUnderGithub().map((path) => ({
      path,
      permissions: extractTopLevelWorkflowPermissions(readRepoFile(path)),
    }));
    const writePermissions = workflowPermissions.flatMap(({ path, permissions }) =>
      Object.entries(permissions).flatMap(([permission, access]) =>
        access === "write" ? [`${path}:${permission}`] : [],
      ),
    );

    expect(workflowPermissions).toEqual([
      {
        path: ".github/workflows/ci.yml",
        permissions: {
          contents: "read",
        },
      },
      {
        path: ".github/workflows/deploy-site.yml",
        permissions: {
          contents: "read",
        },
      },
      {
        path: ".github/workflows/label-sync.yml",
        permissions: {
          contents: "read",
          issues: "write",
        },
      },
      {
        path: ".github/workflows/labeler.yml",
        permissions: {
          contents: "read",
          "pull-requests": "write",
        },
      },
      {
        path: ".github/workflows/linux-build-check.yml",
        permissions: {
          contents: "read",
        },
      },
      {
        path: ".github/workflows/pr-insights-labeler.yml",
        permissions: {
          contents: "read",
          issues: "write",
          "pull-requests": "write",
        },
      },
      {
        path: ".github/workflows/release-start.yml",
        permissions: {},
      },
      {
        path: ".github/workflows/release.yml",
        permissions: {
          contents: "write",
        },
      },
      {
        path: ".github/workflows/store-msix.yml",
        permissions: {
          contents: "read",
        },
      },
    ]);
    expect(writePermissions).toEqual([
      ".github/workflows/label-sync.yml:issues",
      ".github/workflows/labeler.yml:pull-requests",
      ".github/workflows/pr-insights-labeler.yml:issues",
      ".github/workflows/pr-insights-labeler.yml:pull-requests",
      ".github/workflows/release.yml:contents",
    ]);
    expect(writePermissions.filter((permission) => permission.endsWith(":contents"))).toEqual([
      ".github/workflows/release.yml:contents",
    ]);
    expect(writePermissions.filter((permission) => permission.endsWith(":issues"))).toEqual([
      ".github/workflows/label-sync.yml:issues",
      ".github/workflows/pr-insights-labeler.yml:issues",
    ]);
  });

  it("keeps labeler workflows deduplicated by pull request ref", () => {
    const labelerConcurrencyGroup = "$" + "{{ github.workflow }}-" + "$" + "{{ github.ref }}";

    expect(
      [".github/workflows/labeler.yml", ".github/workflows/pr-insights-labeler.yml"].map((path) => ({
        path,
        concurrency: extractTopLevelWorkflowConcurrency(readRepoFile(path)),
      })),
    ).toEqual([
      {
        path: ".github/workflows/labeler.yml",
        concurrency: {
          "cancel-in-progress": "true",
          group: labelerConcurrencyGroup,
        },
      },
      {
        path: ".github/workflows/pr-insights-labeler.yml",
        concurrency: {
          "cancel-in-progress": "true",
          group: labelerConcurrencyGroup,
        },
      },
    ]);
  });

  it("keeps store config updater disabled via empty config instead of null", () => {
    const storeConfig = JSON.parse(readRepoFile("src-tauri/tauri.store.conf.json"));

    // plugins.updater: null crashes plugin initialization at startup ("invalid type: null, expected struct Config").
    expect(storeConfig.plugins.updater).not.toBeNull();
    expect(typeof storeConfig.plugins.updater).toBe("object");
    expect(storeConfig.plugins.updater.endpoints).toEqual([]);
    expect(storeConfig.plugins.updater.pubkey).toBe("");
    expect(storeConfig.bundle.createUpdaterArtifacts).toBe(false);
  });

  it("keeps MSIX manifest Identity version in sync with package.json", () => {
    const manifestSource = readRepoFile("msix/Package.appxmanifest");
    const identityBlock = manifestSource.match(/<Identity\b[\s\S]*?\/>/)?.[0];
    const manifestVersion = identityBlock?.match(/Version="([^"]+)"/)?.[1];

    expect(manifestVersion).toBe(`${packageJson.version}.0`);
  });

  it("runs Store submission tooling from the exact workflow commit with the built MSIX", () => {
    const workflow = readRepoFile(".github/workflows/store-msix.yml");

    expect(workflow).toContain("ref: $" + "{{ github.workflow_sha }}");
    expect(workflow).toContain(
      "./store-workflow/scripts/release/submit-store.ps1 -PackagePath ./msix-out/ultra-rss-reader.msix",
    );
    expect(workflow).toContain("-AutoCommit:($env:AUTO_COMMIT -ceq 'true')");
  });

  it("keeps release dry-run version sources consistent", () => {
    const packageVersion = packageJson.version;

    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(extractCargoPackageField(readRepoFile("src-tauri/Cargo.toml"), "version")).toBe(packageVersion);
    expect(tauriConfig.version).toBe(packageVersion);
  });

  it("keeps migration manifest versions aligned with the Rust runner", () => {
    const migrationSource = readMigrationModuleSource();
    const fileVersions = migrationVersionsFromFiles();
    const fileVersionSet = new Set(fileVersions);
    const latestVersion = extractRustLatestMigrationVersion(migrationSource);
    const expectedVersions = Array.from({ length: latestVersion }, (_, index) => index + 1);
    const missingFileVersions = expectedVersions.filter((version) => !fileVersionSet.has(version));
    const unhandledFileVersions = fileVersions.filter((version) => {
      const hasEmbeddedSql = migrationSource.includes(`MIGRATION_V${version}`);
      const hasInlineHelper = migrationSource.includes(`apply_v${version}_`);
      return !hasEmbeddedSql && !hasInlineHelper;
    });

    expect(latestVersion).toBe(Math.max(...fileVersions));
    expect(missingFileVersions).toEqual([10]);
    expect(migrationSource).toContain("set_schema_version(&tx, 10)");
    expect(unhandledFileVersions).toEqual([]);
  });

  it("keeps dev scenario implementation behind the runtime production guard", () => {
    const scenarioRuntime = readRepoFile("src/dev/scenario-runtime.ts");
    const runtimeGuardIndex = scenarioRuntime.indexOf("if (!import.meta.env.DEV)");
    const sourceFiles = [
      ...readdirSync(join(repoRoot, "src"), { recursive: true })
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => /\.(ts|tsx)$/.test(entry)),
    ];
    const eagerScenarioImports = sourceFiles.flatMap((entry) => {
      const filePath = `src/${entry}`;
      const posixFilePath = toPosixPath(filePath);
      if (posixFilePath.startsWith("src/dev/") || posixFilePath.startsWith("src/__tests__/")) {
        return [];
      }
      const source = readRepoFile(filePath);
      return source.includes("@/dev/scenarios") ? [posixFilePath] : [];
    });

    expect(runtimeGuardIndex).toBeGreaterThanOrEqual(0);
    expect(scenarioRuntime).toContain("return Promise.resolve(");
    expect(scenarioRuntime).toContain('type: "unavailable"');
    expect(scenarioRuntime).toContain(
      'import { DEV_SCENARIO_MODULE_IMPORTERS } from "@/dev/scenarios/import-registry"',
    );
    expect(readRepoFile("src/dev/scenarios/import-registry.ts")).toContain(
      "} as const satisfies Record<DevScenarioId, () => Promise<unknown>>;",
    );
    expect(eagerScenarioImports).toEqual([]);
  });

  it("keeps direct Valibot imports limited to schema owners and validation boundaries", () => {
    const valibotImportPattern = /\bfrom\s+["']valibot["']|\bimport\(\s*["']valibot["']\s*\)/;
    const directValibotImportPaths = typescriptFilesUnder(["src", "tests"])
      .filter((path) => valibotImportPattern.test(readRepoFile(path)))
      .filter((path) => !isSchemaOwnedValibotImportPath(path))
      .toSorted();

    expect(directValibotImportPaths).toEqual([]);
  });

  it("keeps frontend schema files covered by schema contract tests", () => {
    const schemaFileStems = readDirectoryFileStems("src/schemas").filter((stem) => stem !== "validation");
    const schemaTestSource = typescriptFilesUnder(["src/__tests__/schemas", "src/__tests__/stores"]).map(
      (path) => [path, readRepoFile(path)] as const,
    );

    for (const schemaFileStem of schemaFileStems) {
      expect(
        schemaTestSource.some(
          ([path, source]) =>
            path.includes(`/${schemaFileStem}.test.ts`) || source.includes(`@/schemas/${schemaFileStem}`),
        ),
        `${schemaFileStem} must have frontend schema contract coverage`,
      ).toBe(true);
    }
  });

  it("keeps test-local Valibot schemas out of schema tests unless they exercise parse helpers", () => {
    const localValibotSchemaDeclarations = typescriptFilesUnder(["src/__tests__/schemas"])
      .filter((path) => path !== "src/__tests__/schemas/parse.test.ts")
      .flatMap((path) => {
        const source = readRepoFile(path);
        return /\bconst\s+\w+Schema\s*=\s*(?:[A-Za-z_$][\w$]*\.)?(?:object|pipe|strictObject|looseObject|variant|union|picklist|record|array|string|number|boolean)\s*\(/.test(
          source,
        )
          ? [path]
          : [];
      });

    expect(localValibotSchemaDeclarations).toEqual([]);
  });

  it("keeps test-only command schema introspection helpers out of production schema modules", () => {
    const tauriCommandReturnContractSource = readRepoFile("tests/tauri-command-return-contract.node.test.ts");

    expect(readRepoFile("src/api/schemas/commands/registry.ts")).not.toContain("commandArgsSchemaKeys");
    expect(tauriCommandReturnContractSource).not.toMatch(
      /commandArgsSchemaKeys[\s\S]*from "\.\.\/src\/api\/schemas\/commands"/,
    );
  });

  it("keeps app select popup stacking owned by the base select popup", () => {
    const appSelectPopupSource = readRepoFile("src/components/shared/app-select-popup.tsx");

    expect(appSelectPopupSource).not.toContain("APP_STACKING_CLASS_NAMES");
  });

  it("keeps reader keyboard navigation docs aligned with pane owner files", () => {
    const keyboardDocs = readRepoFile("docs/reader-keyboard-navigation.md");
    const documentedPaths = new Set(extractMarkdownInlineCode(keyboardDocs));
    const ownerPaths = [
      "src/components/reader/account-pane.tsx",
      "src/lib/account/account-pane-navigation.ts",
      "src/components/reader/sidebar.tsx",
      "src/components/reader/hooks/article-list/use-article-list-keydown-handler.ts",
      "src/hooks/use-keyboard.ts",
      "src/lib/reader-focus.ts",
    ];

    expect(ownerPaths.filter((path) => !documentedPaths.has(path))).toEqual([]);
    expect(ownerPaths.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
  });

  it("keeps GitHub issue templates aligned with label taxonomy sources", () => {
    const issueTemplateText = issueTemplates.join("\n");

    for (const label of labelerManagedLabels) {
      expect(labelerConfig).toContain(`${label}:`);
    }

    expect(extractLabelerLabelsForGlob(labelerConfig, "scripts/**")).toSatisfy((labels: string[]) =>
      labels.some((label) => automationMaintenanceLabelSet.has(label)),
    );
    expect(extractLabelerLabelsForGlob(labelerConfig, "mise.toml")).toSatisfy((labels: string[]) =>
      labels.some((label) => automationMaintenanceLabelSet.has(label)),
    );
    expect(extractLabelerLabelsForGlob(labelerConfig, "tests/**")).toContain("category/tests");
    expect(extractLabelerLabelsForGlob(labelerConfig, "e2e/**")).toContain("category/tests");
    expect(extractLabelerLabelsForGlob(labelerConfig, "playwright*.config.ts")).toContain("category/tests");
    expect(extractLabelerLabelsForGlob(labelerConfig, ".storybook/**")).toContain("ui");
    expect(extractLabelerLabelsForPath(labelerConfig, ".storybook/main.ts")).toContain("ui");
    expect(extractLabelerLabelsForPath(labelerConfig, ".storybook/preview.ts")).toContain("ui");
    expect(extractLabelerLabelsForPath(labelerConfig, "playwright.storybook.config.ts")).toContain("category/tests");

    for (const template of issueTemplates) {
      expect(template).toContain("`.github/labeler.yml` の自動付与を source of truth");
      expect(template).toContain("PR insights と maintainer 確認を source of truth");
      expect(template).toContain("運用ラベルは、起票後に maintainer が補完します");
    }

    for (const label of [...maintainerManagedLabels, ...prInsightsManagedLabels]) {
      expect(issueTemplateText).toContain(label);
    }

    expect(issueTemplates.flatMap(extractIssueTemplateDefaultLabels)).toEqual([...issueTemplateDefaultLabels]);
    expect(
      issueTemplates
        .flatMap(extractIssueTemplateDefaultLabels)
        .filter((label) => label !== "category/tests" && maintainerManagedLabelSet.has(label)),
    ).toEqual([]);
    expect(issueTemplates.flatMap(extractIssueTemplateDefaultLabels)).not.toEqual(
      expect.arrayContaining(["manual-verification", "release-readiness"]),
    );
    expect(extractIssueTemplateCheckboxLabels(issueTestTemplate, "follow-up-labels")).toEqual(
      expect.arrayContaining(["manual-verification が必要", "release-readiness に入る"]),
    );
  });

  it("keeps issue affected areas aligned with automatic area labels", () => {
    const bugAffectedAreaOptions = extractIssueTemplateCheckboxLabels(issueBugTemplate, "areas");

    expect(bugAffectedAreaOptions).toContain("ワークフロー / 設定 (GitHub Actions / mise / tooling)");
    expect(
      [".github/workflows/ci.yml", "mise.toml"].flatMap((path) => extractLabelerLabelsForPath(labelerConfig, path)),
    ).toEqual(expect.arrayContaining(["ci", "maintenance-family"]));
    expect(new Set(automaticAffectedAreaLabelParity.map(({ templateName }) => templateName))).toEqual(
      new Set(pathLabelableAffectedAreaTemplateNames),
    );

    for (const templateName of pathLabelableAffectedAreaTemplateNames) {
      const templateCase = automaticAffectedAreaLabelParity.find((entry) => entry.templateName === templateName);

      expect(templateCase, `${templateName} template should be covered by area label parity`).toBeDefined();

      if (!templateCase) {
        continue;
      }

      const affectedAreaOptions = extractIssueTemplateCheckboxLabels(templateCase.template, "areas");

      for (const { optionByTemplateName, paths, labels } of sharedAutomaticAffectedAreaLabelParity) {
        const option = optionByTemplateName[templateName];

        expect(
          affectedAreaOptions,
          `${templateName} template should include shared auto-labelable area ${option}`,
        ).toContain(option);
        expect(paths.flatMap((path) => extractLabelerLabelsForPath(labelerConfig, path))).toEqual(
          expect.arrayContaining([...labels]),
        );
      }
    }

    const automaticAffectedAreaOptions = new Set(
      automaticAffectedAreaLabelParity.flatMap(({ entries }) => entries.map(({ option }) => option)),
    );

    for (const { templateName, template, entries } of automaticAffectedAreaLabelParity) {
      const affectedAreaOptions = extractIssueTemplateCheckboxLabels(template, "areas");

      for (const { option, paths, labels } of entries) {
        expect(affectedAreaOptions, `${templateName} template should include ${option}`).toContain(option);

        for (const label of labels) {
          expect(labelerConfig).toContain(`${label}:`);
        }

        expect(paths.flatMap((path) => extractLabelerLabelsForPath(labelerConfig, path))).toEqual(
          expect.arrayContaining([...labels]),
        );
      }
    }

    for (const { templateName, template, options } of maintainerManagedAffectedAreas) {
      const affectedAreaOptions = extractIssueTemplateCheckboxLabels(template, "areas");

      for (const option of options) {
        expect(affectedAreaOptions, `${templateName} template should keep ${option} as maintainer-managed`).toContain(
          option,
        );
        expect(automaticAffectedAreaOptions, `${option} should not be treated as path-labelable`).not.toContain(option);
      }
    }
  });

  it("keeps release note labels aligned with labeler taxonomy sources", () => {
    const releaseNoteLabels = extractReleaseNoteCategoryLabels(releaseNotesConfig);
    const labelerRuleLabels = extractLabelerRuleLabels(labelerConfig);
    const excludedReleaseNoteLabels = extractReleaseNoteExcludedLabels(releaseNotesConfig);
    const releaseNoteLabelSet = new Set(releaseNoteLabels);
    const labelerRuleLabelSet = new Set(labelerRuleLabels);
    const excludedReleaseNoteLabelSet = new Set(excludedReleaseNoteLabels);

    expect(releaseNoteLabelParityLabels.filter((label) => !releaseNoteLabelSet.has(label))).toEqual([]);
    expect(releaseNoteLabelParityLabels.filter((label) => !labelerRuleLabelSet.has(label))).toEqual([]);
    expect(releaseNoteLabelParityLabels.filter((label) => excludedReleaseNoteLabelSet.has(label))).toEqual([]);
  });
});
