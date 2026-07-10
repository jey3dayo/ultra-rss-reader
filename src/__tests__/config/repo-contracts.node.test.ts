import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import {
  extractMarkdownCheckboxLabels,
  extractMarkdownInlineCode,
  extractMarkdownLinks,
  extractMarkdownRelativeLinks,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "@tests/helpers/repo-contract-parser";
import { describe, expect, it } from "vitest";
import {
  queryKeys,
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
import pullRequestTemplate from "../../../.github/PULL_REQUEST_TEMPLATE.md?raw";
import releaseNotesConfig from "../../../.github/release.yml?raw";
import prInsightsLabelerWorkflow from "../../../.github/workflows/pr-insights-labeler.yml?raw";
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
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import tauriReleaseConfig from "../../../src-tauri/tauri.release.conf.json";

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

function listRepoRootYamlFiles(): string[] {
  return readdirSync(repoRoot)
    .filter((entry) => /\.(?:ya?ml)$/u.test(entry))
    .filter((entry) => entry !== "pnpm-lock.yaml")
    .toSorted();
}

function expectPackageJsonKnipEntryConfig(): { entry?: string[] } {
  const { knip } = packageJson;

  if (typeof knip !== "object" || knip === null) {
    throw new TypeError("Expected package.json knip to be an object");
  }

  if (!("entry" in knip)) {
    return {};
  }

  const { entry } = knip;

  if (!Array.isArray(entry) || !entry.every((value): value is string => typeof value === "string")) {
    throw new TypeError("Expected package.json knip.entry to be a string array");
  }

  return { entry };
}

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readMiseTaskCorpus() {
  return ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
    .map(readRepoFile)
    .join("\n");
}

function githubExpression(expression: string) {
  return `${"$"}{{ ${expression} }}`;
}

function matrixArtifactName(prefix: string, suffix: string) {
  return `name: ${prefix}-${githubExpression("matrix.os")}-${suffix}`;
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

function collectTypeSurfaceFiles(path: string): string[] {
  const directoryPath = join(repoRoot, path);
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(path, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTypeSurfaceFiles(entryPath));
    } else if (entry.name.endsWith(".types.ts")) {
      files.push(toPosixPath(entryPath));
    }
  }

  return files.toSorted();
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

function extractMiseRunTasks(source: string) {
  return [...source.matchAll(/\bmise\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
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

function extractWorkflowUses(source: string, path: string) {
  return [...source.matchAll(/^(\s*)uses:\s*["']?([^"'\s#]+)["']?/gm)].map((match) => ({
    path,
    line: source.slice(0, match.index).split("\n").length,
    uses: match[2] ?? "",
  }));
}

function isPinnedWorkflowUses(uses: string) {
  if (uses.startsWith("./")) {
    return workflowLocalReusableActionAllowlist.has(uses);
  }

  const ref = uses.match(/@([^@]+)$/)?.[1] ?? "";
  return /^[0-9a-f]{40}$/i.test(ref) || workflowUsesRefAllowlist.has(uses);
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

function extractWorkflowCheckJobSections(source: string) {
  return extractWorkflowCheckJobIds(source).map((jobId) => {
    const section =
      source.match(
        new RegExp(`^  ${jobId}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n    name:|(?![\\s\\S]))`, "m"),
      )?.[1] ?? "";

    return { jobId, section };
  });
}

function extractMiseToolVersion(source: string, toolName: string) {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`^(?:"${escapedToolName}"|${escapedToolName})\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? null;
}

function extractMiseEnvValue(source: string, envName: string) {
  const escapedEnvName = envName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`^${escapedEnvName}\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? null;
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

function extractPackageManagerVersion(packageManager: string, managerName: string) {
  return packageManager.match(new RegExp(`^${managerName}@(.+)$`))?.[1] ?? null;
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

function extractPlaywrightWebServerTimeout(source: string) {
  const timeoutExpression = source.match(/\bwebServer:\s*{[^}]*\btimeout:\s*([^,\n]+)/s)?.[1]?.trim() ?? "";
  const timeoutValue =
    timeoutExpression.match(/^\d+$/)?.[0] ??
    source.match(new RegExp(`\\bconst\\s+${timeoutExpression}\\s*=\\s*(\\d+)`))?.[1];

  return Number(timeoutValue ?? Number.NaN);
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

function extractCargoPackageVersion(source: string) {
  const packageStart = source.indexOf("[package]");
  const nextSection = source.indexOf("\n[", packageStart + "[package]".length);
  const packageSection = source.slice(packageStart, nextSection === -1 ? undefined : nextSection);
  return packageSection.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
}

function markdownFilesUnderDirectory(path: string) {
  return readdirSync(join(repoRoot, path), { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => toPosixPath(join(path, entry)))
    .filter((filePath) => statSync(join(repoRoot, filePath)).isFile() && filePath.endsWith(".md"));
}

function markdownFilesUnderDocs() {
  const topLevelDocs = ["AGENTS.md", "README.md", "CLAUDE.md", ".claude/rules/README.md", "docs/README.md"];
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

function isSchemaOwnedZodImportPath(path: string) {
  return (
    path.startsWith("src/api/schemas/") ||
    path.startsWith("src/schemas/") ||
    path === "src/__tests__/api/schemas.node.test.ts" ||
    path.startsWith("src/__tests__/api/schemas/") ||
    path === "src/__tests__/schemas/parse.test.ts" ||
    path === "tests/helpers/command-args-schema-keys.ts"
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
  "bug",
  "chore",
  "dependencies",
  "docs",
  "enhancement",
  "feature",
  "fix",
  "refactor",
] as const;
const storybookStoryHelperExportAllowlist = new Set(
  extractStorybookHelperExportAllowlist(readRepoFile("tests/helpers/storybook-story-export-registry.ts")).map(
    ({ storyFilePath, helperExportName }) => `${storyFilePath.replace(/^\/+/, "")}:${helperExportName}`,
  ),
);
const officialTauriV2ConfigSchemaUrl = "https://schema.tauri.app/config/2";
const workflowUsesRefAllowlist = new Set(["dtolnay/rust-toolchain@stable"]);
const workflowLocalReusableActionAllowlist = new Set<string>();
const maintainerManagedLabelSet = new Set<string>(maintainerManagedLabels);
const automationMaintenanceLabelSet = new Set(["ci", "maintenance-family"]);
const auditedReaderTypeSurfacePathSet = new Set([
  "src/components/reader/add-feed-dialog.types.ts",
  "src/components/reader/browser-view.types.ts",
  "src/components/reader/command-palette.types.ts",
  "src/components/reader/feed-dialog-form.types.ts",
  "src/components/reader/feed-edit-dialog.types.ts",
  "src/components/reader/feed-tree.types.ts",
  "src/components/reader/hooks/article-list/article-list-controller.types.ts",
  "src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts",
  "src/components/reader/sidebar-feed-section.types.ts",
  "src/components/reader/sidebar-feed-tree.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/reader/sidebar.types.ts",
]);
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

const typeSurfaceInventoryClassifications = ["public contract", "feature-local", "schema-derived"] as const;

const typeSurfaceInventory = [
  {
    path: "src/components/reader/add-feed-dialog.types.ts",
    owner: "components/reader/add-feed-dialog",
    classification: "feature-local",
    consumerScope: "reader add-feed dialog controller, view, shared feed-dialog form types, and focused tests",
    auditedExports: [
      "AddFeedDialogAction",
      "AddFeedDialogController",
      "AddFeedDialogControllerDerived",
      "AddFeedDialogControllerParams",
      "AddFeedDialogFolderSelectionParams",
      "AddFeedDialogProps",
      "AddFeedDialogState",
      "AddFeedDialogViewLabels",
      "DiscoveredFeedOption",
      "ResolveAddFeedDialogDerivedParams",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep add-feed dialog state and controller contracts here while reducer, controller hook, form view, and tests share them.",
  },
  {
    path: "src/components/reader/browser-view.types.ts",
    owner: "components/reader/browser-view",
    classification: "feature-local",
    consumerScope: "reader browser overlay controller, presentation, hooks, stories, and tests",
    auditedExports: [
      "BrowserOverlayActionSurfacePresentation",
      "BrowserOverlayChromeController",
      "BrowserOverlayCloseHandler",
      "BrowserOverlayStageController",
      "BrowserOverlayStageSurfacePresentation",
      "BrowserOverlayToolbarAction",
      "BrowserViewController",
      "BrowserViewGeometry",
      "BrowserViewLayoutDiagnostics",
      "BrowserViewPresentation",
      "BrowserViewScope",
      "BrowserViewSurfacePresentation",
      "BrowserWebviewDiagnosticsPayload",
      "BrowserWebviewStateBinding",
      "ResolveBrowserViewPresentationParams",
      "ResolveBrowserViewSurfacePresentationParams",
    ],
    runtimeBoundary: true,
    followUp:
      "BrowserViewProps is component-local; preserve native webview state and toolbar contracts in this surface.",
  },
  {
    path: "src/components/reader/command-palette.types.ts",
    owner: "components/reader/command-palette",
    classification: "feature-local",
    consumerScope: "reader command palette controller, result rendering, handlers, and focused tests",
    auditedExports: [
      "CommandPaletteActionItem",
      "CommandPaletteControllerResult",
      "CommandPaletteResultsProps",
      "CommandPaletteViewPropsResult",
      "PaletteAction",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep command palette contracts here while actions, controller output, and result-list props stay shared inside the feature.",
  },
  {
    path: "src/components/reader/feed-dialog-form.types.ts",
    owner: "components/reader/feed-dialog-form",
    classification: "feature-local",
    consumerScope: "reader add-feed and feed-edit dialog form composition",
    auditedExports: [
      "FeedDialogControllerFolderSelectProps",
      "FeedDialogFolderSelectionParams",
      "FeedDialogReadonlyFieldProps",
      "FeedDialogSelectOption",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep shared feed-dialog form contracts here while add-feed and feed-edit reuse the same form primitives.",
  },
  {
    path: "src/components/reader/feed-edit-dialog.types.ts",
    owner: "components/reader/feed-edit-dialog",
    classification: "feature-local",
    consumerScope: "reader feed-edit dialog controller, shared feed-dialog form, and focused tests",
    auditedExports: [
      "FeedEditDisplayPreset",
      "FeedEditDialogProps",
      "FeedEditDialogController",
      "FeedEditDialogControllerParams",
      "FeedEditDialogUrlField",
      "SubmitFeedEditsParams",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep feed-edit dialog contracts here while controller, dialog view, and submit helper share the same form state.",
  },
  {
    path: "src/components/reader/feed-tree.types.ts",
    owner: "components/reader/feed-tree",
    classification: "feature-local",
    consumerScope: "reader feed tree view, sidebar feed section, drag helpers, and focused tests",
    auditedExports: [
      "ActiveDropTarget",
      "FeedTreeEmptyState",
      "FeedTreeFeedViewModel",
      "FeedTreeFolderViewModel",
      "FeedTreeRowProps",
      "FeedTreeViewProps",
    ],
    runtimeBoundary: false,
    followUp: "Keep feed tree view contracts here while sidebar sections and drag helpers share row and tree props.",
  },
  {
    path: "src/components/reader/hooks/article-list/article-list-controller.types.ts",
    owner: "components/reader/hooks/article-list",
    classification: "feature-local",
    consumerScope: "reader article-list controller hooks, view-prop builder, presentation helpers, and focused tests",
    auditedExports: [
      "ArticleListSelection",
      "UseArticleListDataParams",
      "UseArticleListDataResult",
      "UseArticleListHeaderActionsParams",
      "UseArticleListHeaderActionsResult",
      "UseArticleListHeaderControllerParams",
      "UseArticleListHeaderControllerResult",
      "UseArticleListHeaderControlsParams",
      "UseArticleListHeaderControlsResult",
      "UseArticleListInteractionsParams",
      "UseArticleListInteractionsResult",
      "UseArticleListPresentationParams",
      "UseArticleListSearchParams",
      "UseArticleListSearchResult",
      "UseArticleListSourcesParams",
      "UseArticleListSourcesResult",
      "UseArticleListViewPropsParams",
      "UseArticleListViewPropsResult",
      "UseArticleListViewStateParams",
      "UseArticleListViewStateResult",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep hook params/results here while article-list controller pieces remain split across focused hook modules.",
  },
  {
    path: "src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts",
    owner: "components/reader/hooks/feed-tree",
    classification: "feature-local",
    consumerScope: "reader feed tree drag hook, pointer event adapter, and feed tree view",
    auditedExports: ["UseFeedTreeDragParams", "UseFeedTreeDragResult", "UseFeedTreePointerDragEventsParams"],
    runtimeBoundary: false,
    followUp:
      "Keep drag hook contracts here while drag state and pointer event bindings are split across feed-tree hook modules.",
  },
  {
    path: "src/components/reader/sidebar-feed-section.types.ts",
    owner: "components/reader/sidebar-feed-section",
    classification: "feature-local",
    consumerScope: "reader sidebar feed section hook, feed tree adapter, navigation, and focused tests",
    auditedExports: [
      "SidebarFeedDragStateParams",
      "SidebarFeedDragStateResult",
      "SidebarFeedNavigationParams",
      "SidebarFeedSectionParams",
      "SidebarFeedSectionResult",
      "SidebarFeedTreeProps",
      "SidebarFeedTreePropsParams",
      "SidebarStartupFolderExpansionParams",
      "SidebarVisibilityFallbackParams",
      "StartupFolderExpansionMode",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep feed section contracts here while sidebar feed tree state, startup expansion, and view props remain split.",
  },
  {
    path: "src/components/reader/sidebar-feed-tree.types.ts",
    owner: "components/reader/sidebar-feed-tree",
    classification: "feature-local",
    consumerScope: "reader sidebar feed tree hook, sidebar feed section, and selection state",
    auditedExports: [
      "SidebarFeedTreeViewMode",
      "SidebarSelection",
      "UseSidebarFeedTreeParams",
      "UseSidebarFeedTreeResult",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep sidebar feed tree hook contracts here while tree view mode and selection bridge sidebar hook modules.",
  },
  {
    path: "src/components/reader/sidebar-runtime.types.ts",
    owner: "components/reader/sidebar-runtime",
    classification: "feature-local",
    consumerScope: "reader sidebar runtime hook, account switcher, UI state adapter, and focused tests",
    auditedExports: [
      "SidebarAccountSelectionParams",
      "SidebarAccountSwitcherResult",
      "SidebarRuntimeResult",
      "SidebarUiStateResult",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep runtime hook contracts here while account selection, sidebar UI state, and runtime output are composed separately.",
  },
  {
    path: "src/components/reader/sidebar-sources.types.ts",
    owner: "components/reader/sidebar-sources",
    classification: "feature-local",
    consumerScope: "reader sidebar source model hook, account status labels, feed tree, tags, and focused tests",
    auditedExports: [
      "SidebarAccountStatusLabels",
      "SidebarAccountStatusLabelsParams",
      "SidebarSourcesParams",
      "SidebarSourcesResult",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep sidebar source contracts here while account/feed/tag source hooks compose a single sidebar source model.",
  },
  {
    path: "src/components/reader/sidebar.types.ts",
    owner: "components/reader/sidebar",
    classification: "feature-local",
    consumerScope: "reader sidebar controller, section hooks, view, stories, and focused tests",
    auditedExports: [
      "SidebarAccountSectionPropsParams",
      "SidebarContentSectionsPropsParams",
      "SidebarContextMenuRenderersResult",
      "SidebarControllerResult",
      "SidebarControllerSectionsParams",
      "SidebarHeaderPropsParams",
      "SidebarSectionPropsParams",
      "SidebarSectionPropsResult",
      "SidebarSmartViewsParams",
      "SidebarSmartViewsPropsParams",
      "SidebarSmartViewsResult",
      "SidebarViewPropsParams",
      "SidebarViewPropsResult",
    ],
    runtimeBoundary: false,
    followUp: "Keep sidebar params/results here while they compose controller, section hook, and view-prop contracts.",
  },
  {
    path: "src/components/settings/account-detail/types.ts",
    owner: "components/settings/account-detail",
    classification: "feature-local",
    consumerScope: "account detail shell, editor hooks, danger-zone hooks, and focused tests",
    auditedExports: ["AccountDetailAccount"],
    runtimeBoundary: false,
    followUp:
      "Keep the AccountDto alias here while account detail hooks share it; sync controls and status-row contracts belong with their owning hooks/views.",
  },
  {
    path: "src/components/settings/settings-page.types.ts",
    owner: "components/settings/settings-page",
    classification: "feature-local",
    consumerScope: "settings page view, wrapper views, preference view-prop hooks, and focused tests",
    auditedExports: ["SettingsPageControl", "SettingsPageViewProps"],
    runtimeBoundary: false,
    followUp:
      "Keep reusable settings page row/control contracts here; preference hook input belongs in settings-preference.ts.",
  },
  {
    path: "src/components/settings/settings-preference.ts",
    owner: "components/settings/settings-preference",
    classification: "feature-local",
    consumerScope: "settings preference view-prop hooks and schema parity focused tests",
    auditedExports: ["SettingsPreferenceSetPref", "SettingsPreferenceViewPropsParams"],
    runtimeBoundary: false,
    followUp:
      "Keep preference hook input contracts here while general, appearance, reading, actions, and debug settings share the same typed setter.",
  },
  {
    path: "src/lib/subscriptions/subscriptions-index.types.ts",
    owner: "lib/subscriptions/subscriptions-index",
    classification: "public contract",
    consumerScope: "subscriptions index state model, page views, detail/list panes, stories, and focused tests",
    auditedExports: [
      "SubscriptionDetailCandidate",
      "SubscriptionDetailMetrics",
      "SubscriptionListGroup",
      "SubscriptionListRow",
      "SubscriptionRowStatus",
      "SubscriptionSummaryCard",
      "SubscriptionSummaryFilterKey",
    ],
    runtimeBoundary: false,
    followUp:
      "Keep subscriptions index view-model contracts here while list, detail, summary, stories, and state model share them.",
  },
  {
    path: "src/lib/ui/action.types.ts",
    owner: "lib/ui",
    classification: "public contract",
    consumerScope: "shared UI action contracts imported across feature views",
    auditedExports: ["UiFeedbackAction"],
    runtimeBoundary: false,
    followUp: "Keep in src/lib while multiple feature or shared UI consumers import it.",
  },
  {
    path: "src/lib/ui/display-state.types.ts",
    owner: "lib/ui",
    classification: "public contract",
    consumerScope: "display-state feedback contracts shared by reader article view, settings account detail, and tests",
    auditedExports: ["UiDisplayState", "UiDisplayStateAction"],
    runtimeBoundary: false,
    followUp:
      "Keep display-state contracts here while feature views share dismissible message/action state without owning the UI primitive.",
  },
  {
    path: "src/lib/ui/toast.types.ts",
    owner: "lib/ui",
    classification: "public contract",
    consumerScope: "toast contracts shared by store, app toast view, updater, reader hooks, settings hooks, and tests",
    auditedExports: ["ToastAction", "ToastData", "ToastSeverity"],
    runtimeBoundary: false,
    followUp:
      "Keep toast contracts here while notification state and actions are used across reader, settings, hooks, shared UI, and tests.",
  },
  {
    path: "src/stores/preferences-store.types.ts",
    owner: "stores/preferences-store",
    classification: "schema-derived",
    consumerScope: "preferences store state backed by PreferencesDtoSchema-derived values",
    auditedExports: ["PreferencesActions", "PreferencesState"],
    runtimeBoundary: true,
    followUp: "Keep PreferencesDto as the store source of truth unless UI view-model state intentionally differs.",
  },
] as const satisfies readonly {
  path: string;
  owner: string;
  classification: (typeof typeSurfaceInventoryClassifications)[number];
  consumerScope: string;
  auditedExports?: readonly string[];
  runtimeBoundary: boolean;
  followUp: string;
}[];

describe("repository static contracts", () => {
  it("keeps query invalidation target matrices covering every non-account query root", () => {
    const invalidationTargetRoots = [
      ...resolveFeedInvalidationQueryKeys({ includeAccountUnreadCount: true }),
      ...resolveArticleInvalidationQueryKeys({
        includeTagArticleCounts: true,
        includeFeedIntegrityReport: true,
      }),
    ];
    const mutationTargetRoots = [
      ...resolveArticleMutationInvalidationQueryKeys("article-read-star"),
      ...resolveArticleMutationInvalidationQueryKeys("mute-keyword"),
      ...resolveArticleMutationInvalidationQueryKeys("tag-article-assignment"),
      ...resolveArticleMutationInvalidationQueryKeys("tag-metadata"),
      ...resolveAddFeedInvalidationQueryKeys({ accountId: "acc-1" }),
      ...resolveDeleteFeedInvalidationQueryKeys({ accountId: "acc-1" }),
    ];
    const reachableRootNames = new Set(
      [...invalidationTargetRoots, ...mutationTargetRoots].map((queryKey) => queryKey[1]),
    );

    expect(
      Object.values(queryKeys)
        .map((entry) => entry.root[1])
        .toSorted(),
    ).toEqual([
      "accountArticles",
      "accountStarredCount",
      "accountUnreadCount",
      "accounts",
      "articles",
      "articlesByTag",
      "feedArticleSummaries",
      "feedIntegrityReport",
      "feeds",
      "folderArticles",
      "folders",
      "recentArticles",
      "search",
      "starredArticles",
      "tagArticleCounts",
    ]);
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
      "recentArticles",
      "search",
      "starredArticles",
      "tagArticleCounts",
    ]);
  });

  it("keeps Node and pnpm versions aligned between package.json and mise", () => {
    const miseSource = readMiseTaskCorpus();
    const packageManagerVersion = extractPackageManagerVersion(packageJson.packageManager, "pnpm");
    const miseNodeVersion = extractMiseToolVersion(miseSource, "node");
    const misePnpmVersion = extractMiseToolVersion(miseSource, "npm:pnpm");

    expect(packageJson.engines.node).toBe("26.4.0");
    expect(Object.keys(packageJson.engines).toSorted()).toEqual(["node", "pnpm"]);
    expect(packageJson.engines.pnpm).toBe(packageManagerVersion);
    expect(packageJson.packageManager).toBe(`pnpm@${packageJson.engines.pnpm}`);
    expect(miseNodeVersion).toBe(packageJson.engines.node);
    expect(packageManagerVersion).toBe("11.10.0");
    expect(misePnpmVersion).toBe(packageManagerVersion);
  });

  it("keeps the base Tauri config on the official v2 schema URL", () => {
    expect(tauriConfig.$schema).toBe(officialTauriV2ConfigSchemaUrl);
  });

  it("keeps markdown format and lint tasks on the same glob inventory", () => {
    const miseSource = readMiseTaskCorpus();
    const markdownArguments = [
      "$MD_GLOB",
      "$MD_EXCLUDE_NODE_MODULES",
      "$MD_EXCLUDE_PNPM_STORE",
      "$MD_EXCLUDE_WORKTREES",
      "$MD_EXCLUDE_TARGET",
      "$MD_EXCLUDE_TAURI_GEN",
    ].join(" ");
    const markdownWindowsArguments = [
      "$env:MD_GLOB",
      "$env:MD_EXCLUDE_NODE_MODULES",
      "$env:MD_EXCLUDE_PNPM_STORE",
      "$env:MD_EXCLUDE_WORKTREES",
      "$env:MD_EXCLUDE_TARGET",
      "$env:MD_EXCLUDE_TAURI_GEN",
    ].join(" ");

    expect(extractMiseEnvValue(miseSource, "MD_GLOB")).toBe("**/*.md");
    expect(extractMiseEnvValue(miseSource, "MD_EXCLUDE_NODE_MODULES")).toBe("#**/node_modules/**");
    expect(extractMiseEnvValue(miseSource, "MD_EXCLUDE_PNPM_STORE")).toBe("#**/.pnpm-store/**");
    expect(extractMiseEnvValue(miseSource, "MD_EXCLUDE_WORKTREES")).toBe("#**/.worktrees/**");
    expect(extractMiseEnvValue(miseSource, "MD_EXCLUDE_TARGET")).toBe("#**/target/**");
    expect(extractMiseEnvValue(miseSource, "MD_EXCLUDE_TAURI_GEN")).toBe("#src-tauri/gen/**");
    expect(extractMiseTaskCommand(miseSource, "format:md")).toBe(`markdownlint-cli2 ${markdownArguments} --fix`);
    expect(extractMiseTaskCommand(miseSource, "format:md", "run_windows")).toBe(
      `markdownlint-cli2 ${markdownWindowsArguments} --fix`,
    );
    expect(extractMiseTaskCommand(miseSource, "lint:md")).toBe(`markdownlint-cli2 ${markdownArguments}`);
    expect(extractMiseTaskCommand(miseSource, "lint:md", "run_windows")).toBe(
      `markdownlint-cli2 ${markdownWindowsArguments}`,
    );
  });

  it("keeps API schema files covered by barrel exports and schema tests", () => {
    const schemaFileStems = readDirectoryFileStems("src/api/schemas");
    const schemaBarrelExportTargets = extractSchemaBarrelExportTargets(readRepoFile("src/api/schemas/index.ts"));
    const dedicatedSchemaTestStems = readDirectoryFileStems("src/__tests__/api/schemas").map((fileName) =>
      fileName.replace(/\.test$/, ""),
    );
    const aggregateSchemaTestSource = readRepoFile("src/__tests__/api/schema-barrel-public-api.test.ts");

    expect(schemaFileStems).toEqual([
      "account",
      "account-sync-status",
      "article",
      "browser-webview",
      "commands",
      "common",
      "database-info",
      "discovered-feed",
      "error",
      "feed",
      "feed-article-summary",
      "feed-integrity",
      "folder",
      "local-account-sync",
      "mute-keyword",
      "platform-info",
      "preferences",
      "runtime-contracts",
      "settings-profile",
      "starred-articles",
      "sync-progress",
      "sync-result",
      "tag",
      "update-info",
    ]);
    expect(schemaBarrelExportTargets).toEqual(schemaFileStems);
    expect(dedicatedSchemaTestStems).toEqual([
      "database-info",
      "feed-integrity",
      "platform-info",
      "sync-result",
      "update-info",
    ]);

    for (const schemaFileStem of schemaFileStems) {
      const hasDedicatedTest = dedicatedSchemaTestStems.includes(schemaFileStem);
      const hasAggregateCoverage = aggregateSchemaTestSource.includes(`"${schemaFileStem}"`);

      expect(hasDedicatedTest || hasAggregateCoverage, `${schemaFileStem} must have schema test coverage`).toBe(true);
    }
  });

  it("keeps generated schema and target artifacts outside repo scan inventories", () => {
    const gitignoreSource = readRepoFile(".gitignore");
    const ripgrepIgnoreSource = readRepoFile(".ignore");
    const claudeGuidance = readRepoFile("CLAUDE.md");
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

    expect(claudeGuidance).toContain("Treat `src-tauri/gen/schemas/` as generated Tauri capability schema output");
    expect(claudeGuidance).toContain("Do not hand-edit files there");
    expect(claudeGuidance).toContain("change `src-tauri/capabilities/` or the owning Tauri permission/config source");
    expect(claudeGuidance).toContain("rerun the Tauri CLI command that generated the schema drift");
    expect(claudeGuidance).toContain("review the resulting schema diff as generated output before committing");
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

    expect(packageScripts.dev).toBe("pnpm exec vite");
    expect(packageScripts["dev:tauri:vite"]).toBe("node ./scripts/tauri-dev-vite-manager.ts");
    expect(playwrightWebServerCommand).toBe("pnpm dev:tauri:vite");
    expect(packageScripts[extractPnpmScriptName(playwrightWebServerCommand)]).toBe(packageScripts["dev:tauri:vite"]);
    expect(readRepoFile("scripts/tauri-dev-vite-manager.ts")).toContain("classifyPortOwnerCommandLine");
    expect(extractPlaywrightReuseExistingServerExpression(playwrightConfig)).toBe("false");
    expect(vitePort).toBe(1420);
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

    expect(appE2eSpec).toContain("test.beforeEach(async ({ page }) => {");
    expect(appE2eSpec).toContain("installAppRuntimeErrorGuard(page);");
    expect(appE2eSpec).toContain("test.afterEach(async ({ page }) => {");
    expect(appE2eSpec).toContain("expectNoRuntimeErrors(page);");
    expect(appE2eSpec).toContain("disposeRuntimeErrorGuard(page);");
    expect(runtimeErrorGuardHelper).toContain('page.on("pageerror", pageErrorHandler)');
    expect(runtimeErrorGuardHelper).toContain('page.off("pageerror", pageErrorHandler)');
  });

  it("keeps app and Storybook Playwright artifacts separated", () => {
    const playwrightConfig = readRepoFile("playwright.config.ts");
    const storybookPlaywrightConfig = readRepoFile("playwright.storybook.config.ts");
    const appOutputDir = extractPlaywrightOutputDir(playwrightConfig);
    const storybookOutputDir = extractPlaywrightOutputDir(storybookPlaywrightConfig);
    const appReportFolder = extractPlaywrightHtmlReportFolder(playwrightConfig);
    const storybookReportFolder = extractPlaywrightHtmlReportFolder(storybookPlaywrightConfig);

    expect(appOutputDir).toBe("test-results/e2e");
    expect(storybookOutputDir).toBe("test-results/storybook");
    expect(appReportFolder).toBe("playwright-report/e2e");
    expect(storybookReportFolder).toBe("playwright-report/storybook");
    expect(appOutputDir).not.toBe(storybookOutputDir);
    expect(appReportFolder).not.toBe(storybookReportFolder);
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

    expect([...new Set(ciTasks)].toSorted()).toEqual([
      "app:build:debug",
      "build",
      "format:check",
      "lint",
      "quality:toolchain",
      "test:ci",
    ]);
    expect(ciTasks.filter((task) => !miseTasks.has(task))).toEqual([]);
  });

  it("keeps YAML lint checking its own config", () => {
    const miseSource = readMiseTaskCorpus();

    expect(miseSource).toContain(
      'run = "yamllint -c .yamllint .github/ .yamllint apm.lock.yaml apm.yml lefthook.yml pnpm-workspace.yaml"',
    );
  });

  it("keeps root-level YAML additions out of the lint blind spot", () => {
    expect(listRepoRootYamlFiles()).toEqual(["apm.lock.yaml", "apm.yml", "lefthook.yml", "pnpm-workspace.yaml"]);
  });

  it("keeps CI quality gate waiting on every check job", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(extractQualityGateNeeds(ciWorkflow)).toEqual(extractWorkflowCheckJobIds(ciWorkflow).toSorted());
  });

  it("keeps CI check jobs setting up pnpm runtime cache before install", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    for (const { jobId, section } of extractWorkflowCheckJobSections(ciWorkflow)) {
      const setupIndex = section.indexOf("uses: pnpm/setup@5d160c5bc68a09337ad0d5654e237e03253b5879");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");

      expect(setupIndex, `${jobId} should use pnpm/setup for pnpm store cache`).toBeGreaterThanOrEqual(0);
      expect(section, `${jobId} should install Node 26.4.0 through pnpm runtime`).toContain("runtime: node@26.4.0");
      expect(section, `${jobId} should enable pnpm/setup store cache`).toContain("cache: true");
      expect(section, `${jobId} should avoid automatic non-frozen install`).toContain("install: false");
      expect(installIndex, `${jobId} should install pnpm dependencies after setup`).toBeGreaterThan(setupIndex);
    }
  });

  it("keeps CI verifying package manager and engine contracts through mise and the CI image", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const toolchainSection = extractWorkflowCheckJobSections(ciWorkflow).find(
      ({ jobId }) => jobId === "toolchain",
    )?.section;
    const miseSource = readMiseTaskCorpus();
    const packageJsonSource = readRepoFile("package.json");

    expect(toolchainSection).toContain("mise run quality:toolchain");
    expect(toolchainSection).toContain("Verify CI image toolchain contract");
    expect(toolchainSection).toContain("process.versions.node");
    expect(toolchainSection).toContain('execFileSync("pnpm", ["--version"]');
    expect(extractMiseTaskSection(miseSource, "quality:toolchain")).not.toBe("");
    expect(packageJsonSource).toContain('"packageManager": "pnpm@11.10.0"');
    expect(packageJsonSource).toContain('"node": "26.4.0"');
    expect(packageJsonSource).toContain('"pnpm": "11.10.0"');
  });

  it("keeps CI quality gate summary explicit for skipped or cancelled required matrix jobs", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(ciWorkflow).toContain("Quality Gate Result Inputs");
    expect(ciWorkflow).toContain("failure because every required CI matrix must complete successfully before merge.");
    expect(ciWorkflow).toContain('[ "$result" = "skipped" ] || [ "$result" = "cancelled" ]');
  });

  it("keeps CI failure artifacts classified by frontend, Rust, and native smoke families", () => {
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

  it("keeps native smoke debug build logs and artifacts uploaded only on failure", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const nativeSmokeSection = extractWorkflowCheckJobSections(ciWorkflow).find(
      ({ jobId }) => jobId === "native-smoke",
    )?.section;

    expect(nativeSmokeSection).toContain("mise run app:build:debug 2>&1 | tee");
    expect(nativeSmokeSection).toContain("tmp/ci-artifacts/native-smoke/debug-build.log");
    expect(nativeSmokeSection).toContain("src-tauri/target/debug/bundle/");
    expect(nativeSmokeSection?.match(/if: failure\(\)/g)?.length ?? 0).toBe(2);
  });

  it("keeps Storybook addons and framework backed by dev dependencies", () => {
    const devDependencies = expectPackageJsonStringRecord("devDependencies");
    const addons = storybookConfig.addons ?? [];
    const addonNames = addons.map((addon) => (typeof addon === "string" ? addon : addon.name));
    const framework =
      typeof storybookConfig.framework === "string" ? storybookConfig.framework : storybookConfig.framework?.name;

    expect([...addonNames, framework].filter((name): name is string => Boolean(name))).toEqual([
      "@storybook/addon-a11y",
      "@storybook/addon-docs",
      "@storybook/react-vite",
    ]);
    expect(
      [...addonNames, framework].filter((name): name is string => Boolean(name) && !(name in devDependencies)),
    ).toEqual([]);
  });

  it("keeps Storybook config contracts static", () => {
    const storybookMainSource = readRepoFile(".storybook/main.ts");
    const addons = storybookConfig.addons ?? [];
    const addonNames = new Set(addons.map((addon) => (typeof addon === "string" ? addon : addon.name)));

    expect(addonNames.has("@storybook/addon-a11y")).toBe(true);
    expect(addonNames.has("@storybook/addon-docs")).toBe(true);
    expect(storybookConfig.stories).toEqual(["../src/**/*.stories.@(ts|tsx)"]);
    expect(storybookMainSource).toContain("return mergeConfig(config, {");
    expect(storybookMainSource).toContain('"@": path.resolve(import.meta.dirname, "../src")');
    expect(storybookMainSource).toContain('"@tests": path.resolve(import.meta.dirname, "../tests")');
  });

  it("keeps Storybook a11y addon violations gated with an explicit allowlist", () => {
    const storySourcesWithA11yTodo = storyFilesUnderSrc().filter((filePath) => {
      const source = readRepoFile(filePath);
      return /a11y\s*:\s*\{[^}]*test\s*:\s*["'](?:todo|off)["']/s.test(source);
    });

    expect(STORYBOOK_A11Y_TEST_MODE).toBe("error");
    expect(storybookConfig.addons).toContain("@storybook/addon-a11y");
    expect(STORYBOOK_A11Y_TEST_TODO_ALLOWLIST).toEqual([]);
    expect(storySourcesWithA11yTodo).toEqual([...STORYBOOK_A11Y_TEST_TODO_ALLOWLIST]);
  });

  it("keeps Storybook preview backgrounds aligned with CSS theme canvas tokens", () => {
    const globalCss = readRepoFile("src/styles/global.css");
    const previewBackgroundsByName = new Map(
      STORYBOOK_PREVIEW_BACKGROUNDS.map(({ name, value }) => [name, value] as const),
    );

    expect(STORYBOOK_PREVIEW_BACKGROUND_TOKEN).toBe("--theme-canvas");
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

    expect(designGuidance).toContain("Primary (`#f54e00`)");
    expect(designGuidance).toContain("Unread (`#9fbbe0`)");
    expect(designGuidance).toContain("Loading (`#9fbbe0`)");
    expect(designGuidance).toContain("Starred (`#facc15`)");
    expect(designGuidance).toContain("Dialog and Popup Shells");
    expect(designGuidance).toContain("named scrim roles from the token layer");

    expect(extractCssCustomProperty(globalCss, ":root", "--theme-primary")).toBe("#f54e00");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--theme-primary")).toBe("#f54e00");
    expect(extractCssCustomProperty(globalCss, ":root", "--theme-unread")).toBe("#9fbbe0");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--theme-unread")).toBe("#9fbbe0");
    expect(extractCssCustomProperty(globalCss, ":root", "--theme-starred")).toBe("#facc15");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--theme-starred")).toBe("#facc15");
    expect(extractCssCustomProperty(globalCss, ":root", "--tone-loading")).toBe("var(--theme-unread)");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--tone-loading")).toBe("var(--theme-unread)");
    expect(extractCssCustomProperty(globalCss, ":root", "--dialog-scrim")).toBe("var(--dialog-overlay)");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--dialog-scrim")).toBe("var(--dialog-overlay)");
    expect(extractCssCustomProperty(globalCss, ":root", "--control-active-warm")).toBe("#c08532");
    expect(extractCssCustomProperty(globalCss, ":root.dark", "--control-active-warm")).toBe("#c08532");

    expect(colorRule).toContain("rgba(245, 78, 0, 0.26)");
    expect(colorRule).toContain("rgba(245, 78, 0, 0.38)");
    expect(colorRule).toContain("var(--gradient-switch-track-off)");
    expect(colorRule).not.toContain("oklch(0.65 0.15 250)");
    expect(extractCssCustomProperty(globalCss, ":root", "--gradient-switch-track-on")).toBe(
      "var(--control-active-warm)",
    );
    expect(extractCssCustomProperty(globalCss, ":root", "--gradient-switch-track-off")).toBe("var(--color-input)");
  });

  it("keeps renderStory scoped to Storybook global preview parameters and decorators", () => {
    const renderStoryHelperSource = readRepoFile("tests/helpers/render-story.tsx");

    expect(renderStoryHelperSource).toContain('import preview from "../../.storybook/preview"');
    expect(renderStoryHelperSource).toContain(
      "mergeStoryParameters(preview.parameters, meta.parameters, story.parameters)",
    );
    expect(renderStoryHelperSource).toContain("...collectStoryDecorators<TArgs>(preview.decorators)");
  });

  it("keeps Storybook config changes covered by labeler", () => {
    const storybookConfigPaths = [".storybook/main.ts", ".storybook/preview.ts"] as const;

    expect(extractLabelerLabelsForGlob(labelerConfig, ".storybook/**")).toContain("ui");

    for (const path of storybookConfigPaths) {
      expect(extractLabelerLabelsForPath(labelerConfig, path)).toContain("ui");
    }
  });

  it("keeps file-level tooling entrypoints explicit for knip", () => {
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const knipConfig = expectPackageJsonKnipEntryConfig();

    expect(packageScripts["test:storybook:e2e"]).toContain("--config playwright.storybook.config.ts");
    expect(knipConfig.entry).toEqual(
      expect.arrayContaining(["playwright.storybook.config.ts", "src/dev/scenarios/index.ts"]),
    );
  });

  it("keeps quality baseline diagnostics routed through the pinned script gate", () => {
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const miseSource = readMiseTaskCorpus();

    expect(packageScripts["quality:react-doctor:diff"]).toBe("node ./scripts/quality-baseline.ts react-doctor:diff");
    expect(packageScripts["quality:react-doctor:full"]).toBe("node ./scripts/quality-baseline.ts react-doctor:full");
    expect(packageScripts["quality:knip"]).toBe("node ./scripts/quality-baseline.ts knip");
    expect(packageScripts["quality:lockfile-duplicate-majors"]).toBe(
      "node ./scripts/quality-baseline.ts lockfile-duplicate-majors",
    );
    expect(extractMiseTaskCommand(miseSource, "quality:react-doctor:diff")).toBe(
      "node ./scripts/quality-baseline.ts react-doctor:diff",
    );
    expect(extractMiseTaskCommand(miseSource, "quality:react-doctor:full")).toBe(
      "node ./scripts/quality-baseline.ts react-doctor:full",
    );
    expect(extractMiseTaskCommand(miseSource, "quality:knip")).toBe("node ./scripts/quality-baseline.ts knip");
  });

  it("classifies knip file-level cleanup candidates by their runtime owner", () => {
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const knipConfig = expectPackageJsonKnipEntryConfig();
    const settingsModalSource = readRepoFile("src/components/settings/settings-modal.tsx");
    const addAccountFormSource = readRepoFile("src/components/settings/add-account-form.tsx");
    const addAccountControllerSource = readRepoFile("src/components/settings/add-account/controller.tsx");
    const accountConfigFormSource = readRepoFile("src/components/settings/add-account/account-config-form.tsx");
    const accountConfigFormViewSource = readRepoFile(
      "src/components/settings/add-account/account-config-form-view.tsx",
    );
    const addAccountFormStorySource = readRepoFile("src/components/settings/add-account/add-account-form.stories.tsx");
    const addAccountFormViewTestSource = readRepoFile("src/__tests__/components/add-account-form-view.test.tsx");

    expect(packageScripts["test:storybook:e2e"]).toContain("--config playwright.storybook.config.ts");
    expect(knipConfig.entry).toEqual(
      expect.arrayContaining(["playwright.storybook.config.ts", "src/dev/scenarios/index.ts"]),
    );
    expect(settingsModalSource).toContain('import { AddAccountForm } from "@/components/settings/add-account-form"');
    expect(addAccountFormSource).toContain('from "@/components/settings/add-account/controller"');
    expect(addAccountControllerSource).toContain('from "./account-config-form"');
    expect(accountConfigFormSource).toContain('from "./account-config-form-view"');
    expect(accountConfigFormViewSource).toContain('from "./form-view"');
    expect(addAccountFormStorySource).toContain('from "./controller"');
    expect(addAccountFormViewTestSource).toContain('from "@/components/settings/add-account/account-config-form-view"');
    expect(addAccountFormViewTestSource).toContain('from "@/components/settings/add-account/form-view"');
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

    expect(packageScripts.storybook).toBe("storybook dev -p 6006 --no-open");
    expect(storybookPlaywrightConfig).toContain("const storybookCommand = isWindows");
    expect(storybookPlaywrightConfig).toContain(': "pnpm storybook"');
    expect(extractStorybookDevCommandPorts([storybookPlaywrightConfig, packageScripts.storybook].join("\n"))).toEqual([
      storybookPort,
      storybookPort,
    ]);
    expect(packageScripts[extractPnpmScriptName(storybookWebServerCommand)]).toBe(packageScripts.storybook);
    expect(storybookPort).toBe(6006);
    expect(storybookWebServerUrl).toBe(storybookBaseUrl);
    expect(extractUrlPort(storybookWebServerUrl)).toBe(storybookPort);
    expect(storybookReuseExistingServer).toBe("false");
    expect(extractPlaywrightWebServerTimeout(storybookPlaywrightConfig)).toBe(120000);
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
    expect(readRepoFile("CLAUDE.md")).toContain("[.claude/rules/README.md](.claude/rules/README.md)");
  });

  it("keeps CLAUDE rule links aligned with the rules index", () => {
    const claudeGuidance = readRepoFile("CLAUDE.md");
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

    expect(claudeRuleLinks).toEqual([
      ".claude/rules/README.md",
      ".claude/rules/async-side-effect-policy.md",
      ".claude/rules/boundary-ownership.md",
      ".claude/rules/contract-test-policy.md",
      ".claude/rules/preferences-pattern.md",
      ".claude/rules/quality-policy.md",
      ".claude/rules/result-boundary.md",
      ".claude/rules/runtime-boundary.md",
      ".claude/rules/rust-test-unwrap-policy.md",
      ".claude/rules/schema-boundary.md",
    ]);
    expect(missingFromIndex).toEqual([]);
  });

  it("keeps the docs index free of retired command-wrapper guidance", () => {
    const docsIndex = readRepoFile("docs/README.md");
    const topLevelDocsSection = docsIndex.match(/^## Top-Level Docs\n\n([\s\S]*?)(?=^## )/m)?.[1] ?? "";

    expect(topLevelDocsSection).not.toContain(["R", "T", "K"].join(""));
  });

  it("keeps TODO limited to active backlog entries", () => {
    const todoSource = readRepoFile("TODO.md");
    const completedTodoEntries = [...todoSource.matchAll(/^- \[x\] .+$/gim)].map((match) => match[0]);

    expect(todoSource).toContain("完了済みの項目は `CHANGELOG.md` を参照");
    expect(completedTodoEntries).toEqual([]);
  });

  it("keeps AGENTS as a thin router to CLAUDE guidance", () => {
    const agents = readRepoFile("AGENTS.md");

    expect(agents).toContain("Use `./CLAUDE.md` as the master document");
    expect(agents).toContain("Read order for repository-local guidance: `AGENTS.md` -> `CLAUDE.md`");
    expect(agents).toContain("Keep this file as a thin router only.");
    expect(agents.trim().split("\n").length).toBeLessThanOrEqual(20);
    expect([...agents.matchAll(/^## .+$/gm)].map((match) => match[0])).toEqual(["## Overview", "## Instructions"]);
    expect(agents).not.toContain("## File Placement");
    expect(agents).not.toContain("## Type Surface Policy");
    expect(agents).not.toContain("## Operational Notes");
  });

  it("keeps PR quality gate checklist aligned with AGENTS DoD guidance", () => {
    const agents = readRepoFile("AGENTS.md");
    const confirmedCheckboxes = extractMarkdownCheckboxLabels(pullRequestTemplate, "確認済み");
    const qualityGateCheckboxes = confirmedCheckboxes.filter((checkbox) => !checkbox.startsWith("動作確認完了"));
    const expectedQualityGateCheckboxes = [
      "型エラー 0 件 (`mise run check` の `lint:types`)",
      "リント違反 0 件 (`mise run check` の `lint`)",
      "高速テスト成功 (`mise run check` の `test:unit:fast` / `test:rust`)",
      "フォーマッター適用済み (`mise run check` の `format`)",
      "jsdom / DOM / React rendering / PR handoff / release / native / Storybook 影響時: DOM/CI/focused test を記録",
      "環境変数の変更時: `.env` を暗号化 (`dotenvx encrypt`)",
    ];

    expect(confirmedCheckboxes).toContain("動作確認完了");
    expect(qualityGateCheckboxes).toEqual(expectedQualityGateCheckboxes);

    for (const command of ["mise run check", "mise run test:unit:dom", "mise run ci"] as const) {
      expect(pullRequestTemplate).toContain(command);
      expect(agents).toContain(command);
    }

    for (const impactScope of [
      "jsdom",
      "DOM",
      "React rendering",
      "PR handoff",
      "release",
      "native",
      "Storybook",
    ] as const) {
      expect(pullRequestTemplate).toContain(impactScope);
      expect(agents).toContain(impactScope);
    }
    expect(pullRequestTemplate).toContain("focused test");
    expect(agents).toContain("focused test");
  });

  it("keeps historical command replacements pointed at current mise tasks", () => {
    const superpowersReadme = readRepoFile("docs/superpowers/README.md");
    const miseTasks = extractMiseTaskNames(readMiseTaskCorpus());
    const replacementTargets = extractMiseRunTasks(superpowersReadme);

    expect(replacementTargets).toEqual(["app:dev", "app:dev:browser"]);
    expect(replacementTargets.filter((task) => !miseTasks.has(task))).toEqual([]);
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
    expect(releaseWorkflow).toContain("platform: macos-latest");
    expect(releaseWorkflow).toContain("args: --target aarch64-apple-darwin");
    expect(releaseWorkflow).toContain("platform: windows-latest");
    expect(releaseWorkflow).toContain("--config src-tauri/tauri.release.conf.json");
    expect(releaseWorkflow).toContain("--ci");
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriReleaseConfig.bundle.macOS?.signingIdentity).toBe("-");
  });

  it("keeps release provenance uploads recoverable after partial asset failures", () => {
    const releaseArtifactsScript = readRepoFile("scripts/release/artifacts.ts");

    expect(releaseArtifactsScript).toContain(
      '["release", "view", requiredEnv("RELEASE_TAG"), "--json", "assets,isDraft,isPrerelease,tagName,url"]',
    );
    expect(releaseArtifactsScript).toContain('"assets,isDraft,isPrerelease,tagName,url"');
    expect(releaseArtifactsScript).toContain("clobber_targets=");
    expect(releaseArtifactsScript).toContain("missing_assets=");
    expect(releaseArtifactsScript).toContain("draft=$" + "{release.isDraft}");
    expect(releaseArtifactsScript).toContain("prerelease=$" + "{release.isPrerelease}");
    expect(releaseArtifactsScript).toContain('uploadAssets("checksum upload", "checksum upload failure recovery"');
    expect(releaseArtifactsScript).toContain('uploadAssets("provenance upload", "provenance upload failure recovery"');
    expect(releaseArtifactsScript).toContain(
      '"gh", ["release", "upload", requiredEnv("RELEASE_TAG"), ...assets, "--clobber"]',
    );
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
    expect(tauriConfig.app.security.csp).toContain("connect-src ipc: http://ipc.localhost");
  });

  it("keeps Web Preview ATS relaxation scoped to web content loads", () => {
    const infoPlist = readRepoFile("src-tauri/Info.plist");

    expect(tauriConfig.bundle.macOS?.infoPlist).toBe("Info.plist");
    expect("infoPlist" in tauriReleaseConfig.bundle.macOS).toBe(false);
    expect(infoPlist).toContain("<key>NSAppTransportSecurity</key>");
    expect(infoPlist).toContain("<key>NSAllowsArbitraryLoadsInWebContent</key>");
    expect(infoPlist).toContain("<true/>");
    expect(infoPlist).not.toContain("<key>NSAllowsArbitraryLoads</key>");
  });

  it("documents the release-build condition for Tauri unstable child webview APIs", () => {
    const cargoToml = readRepoFile("src-tauri/Cargo.toml");

    expect(cargoToml).toContain('features = ["image-png", "unstable"]');
    expect(cargoToml).toContain("required for the embedded browser child webview boundary");
    expect(cargoToml).toContain("release-smoke the browser preview open, resize, navigation");
  });

  it("keeps manual release dispatch pinned to explicit version tags", () => {
    const releaseWorkflow = readRepoFile(".github/workflows/release.yml");
    const releaseSourceValidator = readRepoFile("scripts/release/validate-source.ts");
    const workflowDispatchReleaseNameExpression =
      "$" + "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}";

    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("release_tag:");
    expect(releaseWorkflow).toContain('description: "Release tag to publish. Must start with v."');
    expect(releaseWorkflow).toContain("required: true");
    expect(releaseWorkflow).toContain("type: string");
    expect(releaseWorkflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(releaseWorkflow).toContain(["ref: $", "{{ github.ref }}"].join(""));
    expect(releaseWorkflow).not.toContain("format('refs/tags/{0}', inputs.release_tag)");
    expect(releaseWorkflow).toContain("name: Validate release source");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-source.ts");
    expect(releaseSourceValidator).toContain(
      "const RELEASE_TAG_PATTERN = /^v[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$/;",
    );
    expect(releaseSourceValidator).toContain(
      "release tag must match vX.Y.Z, optionally with prerelease or build metadata",
    );
    expect(releaseWorkflow).toContain(`tagName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain(`releaseName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).not.toContain("github.event_name == 'workflow_dispatch' && github.ref");
    expect(releaseWorkflow).not.toContain("github.event_name == 'workflow_dispatch' && github.ref_name");
  });

  it("keeps release install verification separate from local app install helpers", () => {
    const releaseManualVerification = readRepoFile("docs/release-manual-verification.md");
    const readme = readRepoFile("README.md");
    const miseSource = readRepoFile("mise.toml");
    const windowsInstallScript = readRepoFile("scripts/install-windows-app.ts");
    const appInstallTask = extractMiseTaskSection(miseSource, "app:install");

    expect(releaseManualVerification).toContain(
      "Install the published release artifact downloaded from GitHub Releases",
    );
    expect(releaseManualVerification).toContain("Do not use `mise run app:install` for this step");
    expect(releaseManualVerification).toContain("Release asset digest");
    expect(releaseManualVerification).toContain("codesign --verify --deep --strict --verbose=2");
    expect(releaseManualVerification).toContain("spctl --assess --type execute --verbose");
    expect(releaseManualVerification).toContain("Release Provenance And SBOM Record");
    expect(releaseManualVerification).toContain("GitHub workflow run id and run URL");
    expect(releaseManualVerification).toContain("Release Dev-Only Contamination Record");
    expect(releaseManualVerification).toContain("debug-only MCP bridge permissions");
    expect(releaseManualVerification).toContain("Published release artifact name and release URL");
    expect(releaseManualVerification).toContain(
      "Current release policy assumes no Apple Developer Program / Developer ID",
    );
    expect(releaseManualVerification).toContain("Gatekeeper assessment result or ad-hoc signing policy result");
    expect(readme).toContain("Published release install verification must use the artifact from GitHub Releases");
    expect(readme).toContain("macOS releases currently assume no Apple Developer Program / Developer ID");
    expect(readme).toContain("`mise run app:install` rebuilds from the current checkout");
    expect(appInstallTask).toContain("Build, locally re-sign, and install the current checkout");
    expect(appInstallTask).toContain("src-tauri/target/release/bundle/macos");
    expect(appInstallTask).toContain("scripts/install-windows-app.ts");
    expect(windowsInstallScript).toContain('"src-tauri", "target", "release", "bundle"');
  });

  it("keeps bundled app icon provenance and configured icon outputs explicit", () => {
    const docsReadme = readRepoFile("docs/README.md");
    const miseSource = readRepoFile("mise.toml");
    const appIconTask = extractMiseTaskSection(miseSource, "app:icon");
    const bundleIcons = tauriConfig.bundle.icon;

    expect(bundleIcons).toEqual([
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico",
    ]);
    for (const iconPath of bundleIcons) {
      expect(existsSync(join(repoRoot, "src-tauri", iconPath)), iconPath).toBe(true);
    }
    expect(existsSync(join(repoRoot, "assets/app-icon.png"))).toBe(true);
    expect(existsSync(join(repoRoot, "assets/app-icon-tauri-source.png"))).toBe(true);
    expect(existsSync(join(repoRoot, "src-tauri/icons/icon.png"))).toBe(true);
    expect(appIconTask).toContain("tauri icon assets/app-icon-tauri-source.png");
    expect(docsReadme).toContain("Bundled app icon provenance");
    expect(docsReadme).toContain("`assets/app-icon.png` is the checked-in raster design master");
    expect(docsReadme).toContain("`assets/app-icon-tauri-source.png` is the checked-in Tauri source image");
    expect(docsReadme).toContain("project-owned artwork with no third-party attribution requirement");
    expect(docsReadme).toContain("source URL, license, and attribution note");
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
        path: ".github/workflows/labeler.yml",
        permissions: {
          contents: "read",
          "pull-requests": "write",
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
        path: ".github/workflows/release.yml",
        permissions: {
          contents: "write",
        },
      },
    ]);
    expect(writePermissions).toEqual([
      ".github/workflows/labeler.yml:pull-requests",
      ".github/workflows/pr-insights-labeler.yml:issues",
      ".github/workflows/pr-insights-labeler.yml:pull-requests",
      ".github/workflows/release.yml:contents",
    ]);
    expect(writePermissions.filter((permission) => permission.endsWith(":contents"))).toEqual([
      ".github/workflows/release.yml:contents",
    ]);
    expect(writePermissions.filter((permission) => permission.endsWith(":issues"))).toEqual([
      ".github/workflows/pr-insights-labeler.yml:issues",
    ]);
  });

  it("keeps workflow action uses pinned beyond floating branches or major-only refs", () => {
    expect(
      ["actions/checkout@1f2e3d4c5b6a7980f1e2d3c4b5a6978877665544", "dtolnay/rust-toolchain@stable"].filter(
        (uses) => !isPinnedWorkflowUses(uses),
      ),
    ).toEqual([]);
    expect(
      [
        "actions/checkout@v6",
        "actions/checkout@v6.0",
        "actions/checkout@v6.0.2",
        "actions/checkout@6.0.2",
        "actions/checkout@main",
        "actions/checkout@master",
        "./.github/actions/local",
      ].filter(isPinnedWorkflowUses),
    ).toEqual([]);

    const unpinnedUses = workflowFilesUnderGithub().flatMap((path) =>
      extractWorkflowUses(readRepoFile(path), path).flatMap(({ line, uses }) =>
        isPinnedWorkflowUses(uses) ? [] : [`${path}:${line}:${uses}`],
      ),
    );

    expect(unpinnedUses).toEqual([]);
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

  it("keeps updater release readiness checks split between local contracts and packaged verification", () => {
    const updaterCommands = readRepoFile("src-tauri/src/commands/updater_commands.rs");

    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins.updater.endpoints).toEqual([
      "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json",
    ]);
    expect(tauriConfig.plugins.updater.pubkey).toMatch(/\S/);
    expect(updaterCommands).toContain("guard.take()");
    expect(updaterCommands).toContain("updater.check()");
    expect(updaterCommands).toContain('message: "No update available".to_string()');
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(readRepoFile(".github/workflows/release.yml")).toContain("--config src-tauri/tauri.release.conf.json");
    expect(readRepoFile("docs/release-manual-verification.md")).toContain("packaged updater verification passed");
  });

  it("keeps release dry-run version sources consistent", () => {
    const packageVersion = packageJson.version;
    const cargoVersion = extractCargoPackageVersion(readRepoFile("src-tauri/Cargo.toml"));

    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(cargoVersion).toBe(packageVersion);
    expect(tauriConfig.version).toBe(packageVersion);
    expect(readRepoFile("README.md")).toContain(
      "Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.",
    );
  });

  it("keeps migration manifest versions aligned with the Rust runner", () => {
    const migrationSource = readRepoFile("src-tauri/src/infra/db/migration.rs");
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

  it("keeps direct zod imports limited to schema modules and explicit schema contract tests", () => {
    const zodImportPattern = /\bfrom\s+["']zod["']|\bimport\(\s*["']zod["']\s*\)/;
    const directZodImportPaths = typescriptFilesUnder(["src", "tests"])
      .filter((path) => zodImportPattern.test(readRepoFile(path)))
      .filter((path) => !isSchemaOwnedZodImportPath(path))
      .toSorted();

    expect(directZodImportPaths).toEqual([]);
  });

  it("keeps frontend schema files covered by schema contract tests", () => {
    const schemaFileStems = readDirectoryFileStems("src/schemas");
    const schemaTestSource = typescriptFilesUnder(["src/__tests__/schemas", "src/__tests__/stores"]).map(
      (path) => [path, readRepoFile(path)] as const,
    );

    expect(schemaFileStems).toEqual([
      "app-config",
      "parse",
      "preference-values",
      "preferences",
      "storage",
      "subscriptions-workspace",
    ]);
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

  it("keeps test-local zod schemas out of schema tests unless they exercise parse helpers", () => {
    const localZodSchemaDeclarations = typescriptFilesUnder(["src/__tests__/schemas"])
      .filter((path) => path !== "src/__tests__/schemas/parse.test.ts")
      .flatMap((path) => {
        const source = readRepoFile(path);
        return /\bconst\s+\w+Schema\s*=\s*z\./.test(source) ? [path] : [];
      });

    expect(localZodSchemaDeclarations).toEqual([]);
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
    expect(readRepoFile("src/hooks/use-keyboard.ts")).toContain("normalizePaneNavigationKey");
    expect(readRepoFile("src/hooks/use-keyboard.ts")).toContain(
      "targetElement?.closest('[data-sidebar-pane=\"true\"]')",
    );
  });

  it("keeps TypeScript type surface inventory scoped to retained shared contracts", () => {
    const inventoryPaths = typeSurfaceInventory.map(({ path }) => path);
    const inventoryClassifications = new Set(typeSurfaceInventory.map(({ classification }) => classification));
    const representativeSourceGlobs = [
      "src/components/reader/*types.ts",
      "src/components/settings/*types.ts",
      "src/lib/**/*.types.ts",
      "src/stores/*.types.ts",
    ];

    expect(inventoryPaths.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
    expect(inventoryPaths).toEqual([...inventoryPaths].toSorted());
    expect([...inventoryClassifications].toSorted()).toEqual([...typeSurfaceInventoryClassifications].toSorted());
    expect(typeSurfaceInventory.map(({ path, owner }) => `${path}:${owner}`)).toEqual([
      "src/components/reader/add-feed-dialog.types.ts:components/reader/add-feed-dialog",
      "src/components/reader/browser-view.types.ts:components/reader/browser-view",
      "src/components/reader/command-palette.types.ts:components/reader/command-palette",
      "src/components/reader/feed-dialog-form.types.ts:components/reader/feed-dialog-form",
      "src/components/reader/feed-edit-dialog.types.ts:components/reader/feed-edit-dialog",
      "src/components/reader/feed-tree.types.ts:components/reader/feed-tree",
      "src/components/reader/hooks/article-list/article-list-controller.types.ts:components/reader/hooks/article-list",
      "src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts:components/reader/hooks/feed-tree",
      "src/components/reader/sidebar-feed-section.types.ts:components/reader/sidebar-feed-section",
      "src/components/reader/sidebar-feed-tree.types.ts:components/reader/sidebar-feed-tree",
      "src/components/reader/sidebar-runtime.types.ts:components/reader/sidebar-runtime",
      "src/components/reader/sidebar-sources.types.ts:components/reader/sidebar-sources",
      "src/components/reader/sidebar.types.ts:components/reader/sidebar",
      "src/components/settings/account-detail/types.ts:components/settings/account-detail",
      "src/components/settings/settings-page.types.ts:components/settings/settings-page",
      "src/components/settings/settings-preference.ts:components/settings/settings-preference",
      "src/lib/subscriptions/subscriptions-index.types.ts:lib/subscriptions/subscriptions-index",
      "src/lib/ui/action.types.ts:lib/ui",
      "src/lib/ui/display-state.types.ts:lib/ui",
      "src/lib/ui/toast.types.ts:lib/ui",
      "src/stores/preferences-store.types.ts:stores/preferences-store",
    ]);
    expect(typeSurfaceInventory.filter(({ runtimeBoundary }) => runtimeBoundary).map(({ path }) => path)).toEqual([
      "src/components/reader/browser-view.types.ts",
      "src/stores/preferences-store.types.ts",
    ]);
    expect(
      typeSurfaceInventory.filter(({ classification }) => classification === "schema-derived").map(({ path }) => path),
    ).toEqual(["src/stores/preferences-store.types.ts"]);
    expect(
      typeSurfaceInventory.every(({ consumerScope, followUp }) => consumerScope.length > 0 && followUp.length > 0),
    ).toBe(true);
    expect(
      typeSurfaceInventory
        .filter(({ path }) => auditedReaderTypeSurfacePathSet.has(path))
        .every((inventoryItem) => "auditedExports" in inventoryItem && inventoryItem.auditedExports.length > 0),
    ).toBe(true);

    for (const sourceGlob of representativeSourceGlobs) {
      expect(readRepoFile("TODO.md")).not.toContain(sourceGlob);
    }
  });

  it("keeps remaining TypeScript type surface files on an explicit allowlist", () => {
    const remainingTypeSurfaceAllowlist = [
      "src/components/reader/add-feed-dialog.types.ts",
      "src/components/reader/browser-view.types.ts",
      "src/components/reader/command-palette.types.ts",
      "src/components/reader/feed-dialog-form.types.ts",
      "src/components/reader/feed-edit-dialog.types.ts",
      "src/components/reader/feed-tree.types.ts",
      "src/components/reader/hooks/article-list/article-list-controller.types.ts",
      "src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts",
      "src/components/reader/sidebar-feed-section.types.ts",
      "src/components/reader/sidebar-feed-tree.types.ts",
      "src/components/reader/sidebar-runtime.types.ts",
      "src/components/reader/sidebar-sources.types.ts",
      "src/components/reader/sidebar.types.ts",
      "src/components/settings/settings-page.types.ts",
      "src/lib/subscriptions/subscriptions-index.types.ts",
      "src/lib/ui/action.types.ts",
      "src/lib/ui/display-state.types.ts",
      "src/lib/ui/toast.types.ts",
      "src/stores/preferences-store.types.ts",
      "src/stores/ui-store.types.ts",
    ];
    const typeSurfaceFiles = [
      ...collectTypeSurfaceFiles("src/components/reader"),
      ...collectTypeSurfaceFiles("src/components/settings"),
      ...collectTypeSurfaceFiles("src/lib/subscriptions"),
      ...collectTypeSurfaceFiles("src/lib/sync"),
      ...collectTypeSurfaceFiles("src/lib/ui"),
      ...collectTypeSurfaceFiles("src/stores"),
    ].toSorted();

    expect(typeSurfaceFiles).toEqual(remainingTypeSurfaceAllowlist);
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

    expect(issueTemplates.map(extractIssueTemplateDefaultLabels)).toEqual([
      ["feature"],
      ["fix"],
      ["category/tests"],
      ["chore"],
    ]);
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
    expect(prInsightsLabelerWorkflow).toContain(
      "uses: jey3dayo/pr-insights-labeler@e9bccb2e8c9ed048d6022d6ae2e5c85eeed80f16",
    );
    expect(prInsightsLabelerWorkflow).toContain('file_size_limit: "100KB"');
    expect(prInsightsLabelerWorkflow).toContain('pr_files_limit: "50"');
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

    expect(releaseNoteLabels).toEqual([
      "breaking",
      "bug",
      "chore",
      "dependencies",
      "docs",
      "enhancement",
      "feature",
      "fix",
      "refactor",
    ]);
    expect(releaseNoteLabelParityLabels.filter((label) => !releaseNoteLabelSet.has(label))).toEqual([]);
    expect(releaseNoteLabelParityLabels.filter((label) => !labelerRuleLabelSet.has(label))).toEqual([]);
    expect(releaseNoteLabelParityLabels.filter((label) => excludedReleaseNoteLabelSet.has(label))).toEqual([]);
  });
});
