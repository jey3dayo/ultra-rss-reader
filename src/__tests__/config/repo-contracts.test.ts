import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import issueFeatureTemplate from "../../../.github/ISSUE_TEMPLATE/01-feature.yml?raw";
import issueBugTemplate from "../../../.github/ISSUE_TEMPLATE/02-bug.yml?raw";
import issueTestTemplate from "../../../.github/ISSUE_TEMPLATE/03-test-verification.yml?raw";
import issueMaintenanceTemplate from "../../../.github/ISSUE_TEMPLATE/04-maintenance.yml?raw";
import labelerConfig from "../../../.github/labeler.yml?raw";
import pullRequestTemplate from "../../../.github/PULL_REQUEST_TEMPLATE.md?raw";
import releaseNotesConfig from "../../../.github/release.yml?raw";
import prInsightsLabelerWorkflow from "../../../.github/workflows/pr-insights-labeler.yml?raw";
import storybookConfig from "../../../.storybook/main";
import appE2eSpec from "../../../e2e/app.spec.ts?raw";
import runtimeErrorGuardHelper from "../../../e2e/helpers/runtime-error-guard.ts?raw";
import { uiReferenceCanvasStoryIds } from "../../../e2e/storybook/storybook-index-payload";
import packageJson from "../../../package.json";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import tauriReleaseConfig from "../../../src-tauri/tauri.release.conf.json";

const repoRoot = process.cwd();

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

function extractMiseTaskNames(source: string) {
  const taskNames = new Set<string>();

  for (const match of source.matchAll(/^\[tasks(?:\."([^"]+)"|\.([^\]\s]+))\]/gm)) {
    taskNames.add(match[1] ?? match[2]);
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
    .sort();
}

function extractTopLevelWorkflowPermissions(source: string) {
  const permissionsSection = source.match(/^permissions:\n((?: {2}[A-Za-z-]+:\s+\S+\n?)+)/m)?.[1] ?? "";
  const permissions = Object.fromEntries(
    [...permissionsSection.matchAll(/^ {2}([A-Za-z-]+):\s+(\S+)$/gm)]
      .map((match) => [match[1] ?? "", match[2] ?? ""])
      .sort(([leftPermission], [rightPermission]) => leftPermission.localeCompare(rightPermission)),
  );

  return permissions;
}

function extractTopLevelWorkflowConcurrency(source: string) {
  const concurrencySection = source.match(/^concurrency:\n((?: {2}[A-Za-z-]+:\s+.+\n?)+)/m)?.[1] ?? "";
  return Object.fromEntries(
    [...concurrencySection.matchAll(/^ {2}([A-Za-z-]+):\s+(.+)$/gm)]
      .map((match) => [match[1] ?? "", match[2] ?? ""])
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
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
  return /^v?\d+\.\d+(?:\.\d+)?$/.test(ref) || /^[0-9a-f]{40}$/i.test(ref) || workflowUsesRefAllowlist.has(uses);
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
    .sort();
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

function extractPackageManagerVersion(packageManager: string, managerName: string) {
  return packageManager.match(new RegExp(`^${managerName}@(.+)$`))?.[1] ?? null;
}

function extractViteServerPort(source: string) {
  return Number(source.match(/\bserver:\s*{[^}]*\bport:\s*(\d+)/s)?.[1] ?? Number.NaN);
}

function extractUrlPort(url: string) {
  return Number(new URL(url).port);
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
    .sort();
}

function extractConfigAliases(source: string, configPath: string) {
  const aliases = new Map<string, string>();
  const configDir = dirname(configPath);

  for (const match of source.matchAll(/"([^"]+)":\s*path\.(?:resolve|join)\(import\.meta\.dirname,\s*"([^"]+)"\)/g)) {
    const alias = match[1] ?? "";
    const target = match[2] ?? "";
    aliases.set(alias, normalize(join(configDir, target)));
  }

  return Object.fromEntries([...aliases.entries()].sort());
}

function extractCargoPackageVersion(source: string) {
  const packageStart = source.indexOf("[package]");
  const nextSection = source.indexOf("\n[", packageStart + "[package]".length);
  const packageSection = source.slice(packageStart, nextSection === -1 ? undefined : nextSection);
  return packageSection.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
}

function markdownFilesUnderDocs() {
  const topLevelDocs = [
    "AGENTS.md",
    "README.md",
    "CLAUDE.md",
    ".claude/rules/README.md",
    "docs/README.md",
  ];
  const docsFiles = readdirSync(join(repoRoot, "docs")).flatMap((entry) => {
    const path = join("docs", entry);
    const fullPath = join(repoRoot, path);
    return statSync(fullPath).isFile() && path.endsWith(".md") ? [path] : [];
  });
  const ruleFiles = readdirSync(join(repoRoot, ".claude/rules")).flatMap((entry) => {
    const path = join(".claude/rules", entry);
    const fullPath = join(repoRoot, path);
    return statSync(fullPath).isFile() && path.endsWith(".md") ? [path] : [];
  });

  return [...new Set([...topLevelDocs, ...docsFiles, ...ruleFiles])].sort();
}

function storyFilesUnderSrc() {
  return readdirSync(join(repoRoot, "src"), { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.stories\.(ts|tsx)$/.test(entry))
    .map((entry) => normalize(join("src", entry)))
    .sort();
}

function extractStoryFileNamedExports(source: string) {
  return [...source.matchAll(/^\s*export\s+(const|function|class|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((match) => ({
    kind: match[1] ?? "",
    name: match[2] ?? "",
  }));
}

function extractMarkdownLinks(source: string) {
  return [...source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
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
    .sort((a, b) => a - b);
}

function extractRustLatestMigrationVersion(source: string) {
  return Number(source.match(/pub const LATEST_VERSION: i32 = (\d+);/)?.[1] ?? Number.NaN);
}

function extractMarkdownInlineCode(source: string) {
  return [...source.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function extractMarkdownCheckboxLabels(source: string, sectionHeading: string) {
  const sectionStart = source.indexOf(`## ${sectionHeading}`);
  if (sectionStart === -1) {
    return [];
  }

  const nextSectionStart = source.indexOf("\n## ", sectionStart + 1);
  const section = source.slice(sectionStart, nextSectionStart === -1 ? undefined : nextSectionStart);
  return [...section.matchAll(/^- \[ \] (.+)$/gm)].map((match) => match[1] ?? "");
}

function extractIssueTemplateDefaultLabels(source: string) {
  const labelsLine = source.match(/^labels:\s*\[(.*)\]$/m)?.[1] ?? "";
  return [...labelsLine.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
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

  return [...labels].sort();
}

function extractLabelerRuleLabels(source: string) {
  return [...source.matchAll(/^([A-Za-z0-9_/-]+):$/gm)].map((match) => match[1]);
}

function extractReleaseNoteCategoryLabels(source: string) {
  const categoriesSection = source.match(/^\s+categories:\n([\s\S]*)$/m)?.[1] ?? "";
  return [...categoriesSection.matchAll(/^\s+- title: .*\n\s+labels: \[([^\]]+)\]/gm)]
    .flatMap((match) => match[1]?.split(",") ?? [])
    .map((label) => label.trim().replace(/^"|"$/g, ""))
    .filter((label) => label !== "*")
    .sort();
}

function extractReleaseNoteExcludedLabels(source: string) {
  const excludeLabelsSection = source.match(/^\s+exclude:\n\s+labels:\n((?:\s+- .+\n)+)/m)?.[1] ?? "";
  return [...excludeLabelsSection.matchAll(/^\s+- "?([^"\n]+)"?$/gm)].map((match) => match[1]).sort();
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
const storybookStoryHelperExportAllowlist = new Set([
  "src/components/reader/sidebar-selection-review.stories.tsx:SidebarSelectionReviewCanvas",
  "src/components/storybook/ui-reference-button-controls-canvas.stories.tsx:ButtonControlsCanvas",
  "src/components/storybook/ui-reference-foundations-canvas.stories.tsx:FoundationsCanvas",
  "src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx:NavigationCollectionsCanvas",
  "src/components/storybook/ui-reference-settings-canvas.stories.tsx:InputControlsCanvas",
  "src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx:SettingsWorkspaceCanvas",
  "src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx:ShellOverlayCanvas",
  "src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx:ViewSpecimensCanvas",
]);
const workflowUsesRefAllowlist = new Set(["dtolnay/rust-toolchain@stable"]);
const workflowLocalReusableActionAllowlist = new Set<string>();
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

const typeSurfaceInventoryClassifications = [
  "public contract",
  "feature-local",
  "local-only",
  "schema-derived",
] as const;

const typeSurfaceInventory = [
  {
    path: "src/components/reader/article-list.types.ts",
    owner: "components/reader/article-list",
    classification: "feature-local",
    consumerScope: "reader article-list controller, hooks, view, stories, and focused tests",
    auditedExports: [
      "ArticleListSetupState",
      "HandleArticleListKeyboardActionParams",
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
      "Keep only article-list hook params/results that bridge controller, view-prop builders, stories, and focused tests here; local-only hook params stay with their hook files.",
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
    consumerScope: "account detail settings sections, hooks, stories, and focused tests",
    auditedExports: [
      "AccountDangerZoneViewProps",
      "AccountDetailViewProps",
      "AccountGeneralSectionViewProps",
      "AccountSyncSectionViewProps",
    ],
    runtimeBoundary: false,
    followUp:
      "Section view props remain part of AccountDetailViewProps and hook/test contracts; keep them feature-local until the view contract is decomposed.",
  },
  {
    path: "src/components/settings/add-account/services.types.ts",
    owner: "components/settings/add-account",
    classification: "schema-derived",
    consumerScope: "add-account service form options derived from service/provider schema contracts",
    runtimeBoundary: true,
    followUp: "Prefer schema or command-wrapper output types over hand-written DTO copies when this surface changes.",
  },
  {
    path: "src/components/settings/settings-page.types.ts",
    owner: "components/settings/settings-page",
    classification: "feature-local",
    consumerScope: "settings page view, controller, stories, and focused tests",
    auditedExports: ["SettingsPageViewProps", "SettingsPreferenceViewPropsParams"],
    runtimeBoundary: false,
    followUp:
      "Remaining settings page props are shared by multiple preference hooks, wrapper views, and schema parity tests; keep this shared feature contract.",
  },
  {
    path: "src/lib/reader/reader-selection.types.ts",
    owner: "lib/reader",
    classification: "local-only",
    consumerScope: "reader selection helper state used by the reader feature and tests",
    runtimeBoundary: false,
    followUp: "Move to a narrower reader owner if lib/stores stop importing this contract.",
  },
  {
    path: "src/lib/sync/sync-progress-event.types.ts",
    owner: "lib/sync",
    classification: "public contract",
    consumerScope: "sync event contract shared by runtime sync code and UI feedback",
    runtimeBoundary: true,
    followUp: "Keep boundary-facing payload types centralized; derive from a schema if runtime validation is added.",
  },
  {
    path: "src/lib/ui/action.types.ts",
    owner: "lib/ui",
    classification: "public contract",
    consumerScope: "shared UI action contracts imported across feature views",
    runtimeBoundary: false,
    followUp: "Keep in src/lib while multiple feature or shared UI consumers import it.",
  },
  {
    path: "src/stores/preferences-store.types.ts",
    owner: "stores/preferences-store",
    classification: "schema-derived",
    consumerScope: "preferences store state backed by PreferencesDtoSchema-derived values",
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
  it("keeps Node and pnpm versions aligned between package.json and mise", () => {
    const miseSource = readRepoFile("mise.toml");
    const packageManagerVersion = extractPackageManagerVersion(packageJson.packageManager, "pnpm");
    const miseNodeVersion = extractMiseToolVersion(miseSource, "node");
    const misePnpmVersion = extractMiseToolVersion(miseSource, "npm:pnpm");

    expect(packageJson.engines.node).toBe("24");
    expect(packageJson.engines.pnpm).toBe(packageManagerVersion);
    expect(miseNodeVersion).toBe(packageJson.engines.node);
    expect(packageManagerVersion).toBe("10.33.4");
    expect(misePnpmVersion).toBe(packageManagerVersion);
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
    expect(playwrightWebServerCommand).toBe("pnpm dev");
    expect(playwrightWebServerCommand).toBe(
      `pnpm ${Object.entries(packageScripts).find(([, script]) => script === packageScripts.dev)?.[0]}`,
    );
    expect(extractPlaywrightReuseExistingServerExpression(playwrightConfig)).toBe("false");
    expect(vitePort).toBe(1420);
    expect(viteConfig).toContain("strictPort: true");
    expect(extractUrlPort(playwrightBaseUrl)).toBe(vitePort);
    expect(playwrightWebServerUrl).toBe(playwrightBaseUrl);
  });

  it("keeps app E2E tests covered by the runtime error guard", () => {
    const runtimeGuardImports = ["disposeRuntimeErrorGuard", "expectNoPageErrors", "installRuntimeErrorGuard"] as const;

    for (const importedName of runtimeGuardImports) {
      expect(appE2eSpec).toContain(importedName);
      expect(runtimeErrorGuardHelper).toContain(`function ${importedName}`);
    }

    expect(appE2eSpec).toContain("test.beforeEach(async ({ page }) => {");
    expect(appE2eSpec).toContain("installRuntimeErrorGuard(page);");
    expect(appE2eSpec).toContain("test.afterEach(async ({ page }) => {");
    expect(appE2eSpec).toContain("expectNoPageErrors(page);");
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
    const miseTasks = extractMiseTaskNames(readRepoFile("mise.toml"));
    const ciTasks = extractMiseRunTasks(readRepoFile(".github/workflows/ci.yml"));

    expect([...new Set(ciTasks)].sort()).toEqual(["app:build:debug", "build", "format:check", "lint", "test:ci"]);
    expect(ciTasks.filter((task) => !miseTasks.has(task))).toEqual([]);
  });

  it("keeps YAML lint checking its own config", () => {
    const miseSource = readRepoFile("mise.toml");

    expect(miseSource).toContain('run = "yamllint -c .yamllint .github/ .yamllint"');
  });

  it("keeps CI quality gate waiting on every check job", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");

    expect(extractQualityGateNeeds(ciWorkflow)).toEqual(extractWorkflowCheckJobIds(ciWorkflow).sort());
  });

  it("keeps CI check jobs caching the pnpm store before install", () => {
    const ciWorkflow = readRepoFile(".github/workflows/ci.yml");
    const pnpmStorePathExpression = "$" + "{{ steps.pnpm-store.outputs.path }}";
    const pnpmStoreKeyExpression = "$" + "{{ runner.os }}-pnpm-store-" + "$" + "{{ hashFiles('pnpm-lock.yaml') }}";
    const pnpmStoreRestoreKeyExpression = "$" + "{{ runner.os }}-pnpm-store-";

    for (const { jobId, section } of extractWorkflowCheckJobSections(ciWorkflow)) {
      const storePathIndex = section.indexOf("pnpm store path --silent");
      const cacheIndex = section.indexOf("uses: actions/cache@v5.0.5");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");

      expect(storePathIndex, `${jobId} should resolve pnpm store path`).toBeGreaterThanOrEqual(0);
      expect(cacheIndex, `${jobId} should use actions/cache for pnpm store`).toBeGreaterThan(storePathIndex);
      expect(installIndex, `${jobId} should install pnpm dependencies`).toBeGreaterThan(cacheIndex);
      expect(section).toContain(`path: ${pnpmStorePathExpression}`);
      expect(section).toContain(`key: ${pnpmStoreKeyExpression}`);
      expect(section).toContain(pnpmStoreRestoreKeyExpression);
    }
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

  it("keeps file-level tooling entrypoints explicit for knip", () => {
    const packageScripts = expectPackageJsonStringRecord("scripts");
    const knipConfig = expectPackageJsonKnipEntryConfig();

    expect(packageScripts["test:storybook:e2e"]).toContain("--config playwright.storybook.config.ts");
    expect(knipConfig.entry).toEqual(
      expect.arrayContaining(["playwright.storybook.config.ts", "src/dev/scenarios/index.ts"]),
    );
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
    const storybookWebServerUrl =
      storybookPlaywrightConfig.match(/\bwebServer:\s*{[^}]*\burl:\s*"([^"]+)"/s)?.[1] ?? "";
    const storybookReuseExistingServer =
      storybookPlaywrightConfig.match(/\breuseExistingServer:\s*(true|false)/)?.[1] ?? "";
    const storySources = readdirSync(join(repoRoot, "src/components/storybook"))
      .filter((entry) => /^ui-reference-.+\.stories\.tsx$/.test(entry))
      .map((entry) => readRepoFile(join("src/components/storybook", entry)));

    expect(packageScripts.storybook).toBe("storybook dev -p 6006 --no-open");
    expect(storybookPlaywrightConfig).toContain(':"pnpm storybook"'.replace(":", ": "));
    expect(extractUrlPort(storybookBaseUrl)).toBe(6006);
    expect(storybookWebServerUrl).toBe(storybookBaseUrl);
    expect(storybookReuseExistingServer).toBe("false");
    expect([...uiReferenceCanvasStoryIds].sort()).toEqual(storySources.flatMap(extractStorybookCanvasIds).sort());
  });

  it("keeps repository-relative documentation links pointing at existing files", () => {
    const ruleMarkdownFiles = readdirSync(join(repoRoot, ".claude/rules"))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => normalize(join(".claude/rules", entry)))
      .sort();

    expect(markdownFilesUnderDocs()).toEqual(expect.arrayContaining(ruleMarkdownFiles));

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

  it("keeps the docs index linked to top-level RTK guidance", () => {
    const docsIndex = readRepoFile("docs/README.md");
    const topLevelDocsSection = docsIndex.match(/^## Top-Level Docs\n\n([\s\S]*?)(?=^## )/m)?.[1] ?? "";

    expect(topLevelDocsSection).toContain("[../RTK.md](../RTK.md)");
  });

  it("keeps AGENTS as a thin router to CLAUDE guidance", () => {
    const agents = readRepoFile("AGENTS.md");

    expect(agents).toContain("Use `./CLAUDE.md` as the master document");
    expect(agents).toContain("Read order for repository-local guidance: `AGENTS.md` -> `CLAUDE.md`");
    expect(agents).toContain("Keep this file as a thin router only.");
  });

  it("keeps PR quality gate checklist aligned with AGENTS DoD guidance", () => {
    const agents = readRepoFile("AGENTS.md");
    const confirmedCheckboxes = extractMarkdownCheckboxLabels(pullRequestTemplate, "確認済み");
    const qualityGateCheckboxes = confirmedCheckboxes.filter((checkbox) => !checkbox.startsWith("動作確認完了"));
    const expectedQualityGateCheckboxes = [
      "型エラー 0 件 (`mise run check` の `lint:types`)",
      "リント違反 0 件 (`mise run check` の `lint`)",
      "全テスト成功 (`mise run check` の `test`)",
      "フォーマッター適用済み (`mise run check` の `format`)",
      "release / native / Storybook 影響時: `mise run ci` または focused test を確認内容へ記録",
      "環境変数の変更時: `.env` を暗号化 (`dotenvx encrypt`)",
    ];

    expect(confirmedCheckboxes).toContain("動作確認完了");
    expect(qualityGateCheckboxes).toEqual(expectedQualityGateCheckboxes);

    for (const command of ["mise run check", "mise run ci"] as const) {
      expect(pullRequestTemplate).toContain(command);
      expect(agents).toContain(command);
    }

    for (const impactScope of ["release", "native", "Storybook"] as const) {
      expect(pullRequestTemplate).toContain(impactScope);
      expect(agents).toContain(impactScope);
    }

    expect(pullRequestTemplate).toContain("focused test");
    expect(agents).toContain("focused test");
  });

  it("keeps historical command replacements pointed at current mise tasks", () => {
    const superpowersReadme = readRepoFile("docs/superpowers/README.md");
    const miseTasks = extractMiseTaskNames(readRepoFile("mise.toml"));
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
    const releasePreflightIndex = releaseWorkflow.indexOf("run: mise run ci");
    const tauriActionIndex = releaseWorkflow.indexOf("uses: tauri-apps/tauri-action@");

    expect(releaseWorkflow).toContain('tags: ["v*"]');
    expect(releaseWorkflow).toContain("workflow_dispatch:");
    expect(releaseWorkflow).toContain("contents: write");
    expect(releaseWorkflow).toContain("release_tag:");
    expect(releaseWorkflow).toContain("required: true");
    expect(releaseWorkflow).toContain("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')");
    expect(releaseWorkflow).toContain(
      "github.event_name == 'workflow_dispatch' && startsWith(inputs.release_tag, 'v')",
    );
    expect(releaseWorkflow).toContain("ref: >-");
    expect(releaseWorkflow).toContain("format('refs/tags/{0}', inputs.release_tag)");
    expect(releaseWorkflow).not.toContain(`ref: ${unqualifiedWorkflowDispatchReleaseRefExpression}`);
    expect(releasePreflightIndex).toBeGreaterThanOrEqual(0);
    expect(tauriActionIndex).toBeGreaterThanOrEqual(0);
    expect(releasePreflightIndex).toBeLessThan(tauriActionIndex);
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY: ${signingKeyExpression}`);
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${signingPasswordExpression}`);
    expect(releaseWorkflow).toContain(`tagName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain(`releaseName: ${workflowDispatchReleaseNameExpression}`);
    expect(releaseWorkflow).toContain("releaseDraft: true");
    expect(releaseWorkflow).toContain("platform: macos-latest");
    expect(releaseWorkflow).toContain("args: --target aarch64-apple-darwin");
    expect(releaseWorkflow).toContain("platform: windows-latest");
    expect(releaseWorkflow).toContain("--config src-tauri/tauri.release.conf.json --ci");
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
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
      [
        "actions/checkout@v6.0",
        "actions/checkout@v6.0.2",
        "actions/checkout@6.0.2",
        "actions/checkout@1f2e3d4c5b6a7980f1e2d3c4b5a6978877665544",
        "dtolnay/rust-toolchain@stable",
      ].filter((uses) => !isPinnedWorkflowUses(uses)),
    ).toEqual([]);
    expect(
      ["actions/checkout@v6", "actions/checkout@main", "actions/checkout@master", "./.github/actions/local"].filter(
        isPinnedWorkflowUses,
      ),
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
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      const source = readRepoFile(filePath);
      return source.includes("@/dev/scenarios") ? [filePath] : [];
    });

    expect(runtimeGuardIndex).toBeGreaterThanOrEqual(0);
    expect(scenarioRuntime).toContain('return Promise.resolve(Result.fail({ type: "unavailable"');
    expect(scenarioRuntime).toContain('const loadDevScenariosRegistryModule = () => import("@/dev/scenarios")');
    expect(scenarioRuntime).toContain("} as const satisfies Record<DevScenarioId, () => Promise<unknown>>;");
    expect(eagerScenarioImports).toEqual([]);
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

  it("keeps TypeScript type surface inventory scoped to representative shared contracts", () => {
    const inventoryPaths = typeSurfaceInventory.map(({ path }) => path);
    const inventoryClassifications = new Set(typeSurfaceInventory.map(({ classification }) => classification));
    const representativeSourceGlobs = [
      "src/components/reader/*types.ts",
      "src/components/settings/*types.ts",
      "src/lib/**/*.types.ts",
      "src/stores/*.types.ts",
    ];

    expect(inventoryPaths.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
    expect(inventoryPaths).toEqual([...inventoryPaths].sort());
    expect([...inventoryClassifications].sort()).toEqual([...typeSurfaceInventoryClassifications].sort());
    expect(typeSurfaceInventory.map(({ path, owner }) => `${path}:${owner}`)).toEqual([
      "src/components/reader/article-list.types.ts:components/reader/article-list",
      "src/components/reader/browser-view.types.ts:components/reader/browser-view",
      "src/components/reader/sidebar.types.ts:components/reader/sidebar",
      "src/components/settings/account-detail/types.ts:components/settings/account-detail",
      "src/components/settings/add-account/services.types.ts:components/settings/add-account",
      "src/components/settings/settings-page.types.ts:components/settings/settings-page",
      "src/lib/reader/reader-selection.types.ts:lib/reader",
      "src/lib/sync/sync-progress-event.types.ts:lib/sync",
      "src/lib/ui/action.types.ts:lib/ui",
      "src/stores/preferences-store.types.ts:stores/preferences-store",
    ]);
    expect(typeSurfaceInventory.filter(({ runtimeBoundary }) => runtimeBoundary).map(({ path }) => path)).toEqual([
      "src/components/reader/browser-view.types.ts",
      "src/components/settings/add-account/services.types.ts",
      "src/lib/sync/sync-progress-event.types.ts",
      "src/stores/preferences-store.types.ts",
    ]);
    expect(
      typeSurfaceInventory.filter(({ classification }) => classification === "schema-derived").map(({ path }) => path),
    ).toEqual(["src/components/settings/add-account/services.types.ts", "src/stores/preferences-store.types.ts"]);
    expect(
      typeSurfaceInventory.every(({ consumerScope, followUp }) => consumerScope.length > 0 && followUp.length > 0),
    ).toBe(true);
    expect(
      typeSurfaceInventory
        .filter(({ path }) =>
          [
            "src/components/reader/article-list.types.ts",
            "src/components/reader/browser-view.types.ts",
            "src/components/reader/sidebar.types.ts",
          ].includes(path),
        )
        .every((inventoryItem) => "auditedExports" in inventoryItem && inventoryItem.auditedExports.length > 0),
    ).toBe(true);

    for (const sourceGlob of representativeSourceGlobs) {
      expect(readRepoFile("TODO.md")).not.toContain(sourceGlob);
    }
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
    expect(prInsightsLabelerWorkflow).toContain("uses: jey3dayo/pr-insights-labeler@v1.11.1");
    expect(prInsightsLabelerWorkflow).toContain('file_size_limit: "100KB"');
    expect(prInsightsLabelerWorkflow).toContain('pr_files_limit: "50"');
  });

  it("keeps issue affected areas aligned with automatic area labels", () => {
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
