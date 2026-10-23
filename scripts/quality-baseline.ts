import { pathToFileURL } from "node:url";
import { runKnip } from "./quality/knip.ts";
import { runReactDoctor } from "./quality/react-doctor.ts";

export const qualityBaselineRepoScanIgnoredPathPrefixes = [
  "node_modules/",
  "dist/",
  "src-tauri/target/",
  "tmp/",
  "storybook-static/",
  "test-results/",
  "playwright-report/",
  "src-tauri/gen/schemas/",
] as const;

export const markdownlintRepoContract = {
  glob: "**/*.md",
  ignorePatterns: [
    "node_modules",
    ".pnpm-store",
    "dist",
    "tmp",
    "test-results",
    "playwright-report",
    "target",
    "src-tauri/target",
    ".worktrees",
    ".claude/worktrees",
    ".kiro",
    ".plans",
    "plans",
    "docs/superpowers",
    "apm_modules",
    ".agents/skills",
    ".claude/skills",
    ".codex/skills",
  ],
  generatedMarkdownIgnorePatterns: ["src-tauri/gen/**"],
  rootMarkdownFiles: ["AGENTS.md", "README.md"],
} as const;

export const generatedFixtureSnapshotSizeBudget = {
  maxCheckedInFixtureBytes: 20_000,
  maxSnapshotFileCount: 0,
  fixturePathPrefixes: ["tests/fixtures/", "tests/helpers/"],
  generatedReportIgnoredPathPrefixes: ["tmp/", "test-results/", "playwright-report/", "storybook-static/"],
  largeCorpusDirectoryPrefixes: ["tests/fixtures/"],
  reviewExceptionPolicy:
    "Checked-in fixture or snapshot budget increases require a repo-contract update with a focused test.",
} as const;

export const liveProviderTestGateContract = {
  taskName: "test:live",
  requiredEnvKeys: ["FRESHRSS_URL", "FRESHRSS_USER", "FRESHRSS_PASS"],
  commandFragments: ["dotenvx run --", "freshrss_live", "--ignored", "--nocapture"],
  localGateExclusionPolicy:
    "Live provider tests stay out of mise run check and require explicit operator opt-in with redacted evidence.",
  maskingPolicy:
    "Do not print FreshRSS URL, username, password, tokens, cookies, or response bodies in live test logs or verification notes.",
} as const;

export function runQualityBaseline(command: string | undefined = process.argv[2]): void {
  if (
    command !== "react-doctor:diff" &&
    command !== "react-doctor:full" &&
    command !== "knip" &&
    command !== "knip:check"
  ) {
    console.error("Usage: node scripts/quality-baseline.ts react-doctor:diff|react-doctor:full|knip|knip:check");
    process.exit(2);
  }

  if (command === "react-doctor:diff") {
    runReactDoctor("diff", true);
  } else if (command === "react-doctor:full") {
    runReactDoctor("full", false);
  } else if (command === "knip") {
    runKnip(false);
  } else {
    runKnip(true);
  }
}

export function isQualityBaselineRepoScanIgnoredPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoScanPath(filePath);
  return qualityBaselineRepoScanIgnoredPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

export function isGeneratedReportArtifactPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoScanPath(filePath);
  return generatedFixtureSnapshotSizeBudget.generatedReportIgnoredPathPrefixes.some((prefix) =>
    normalizedPath.startsWith(prefix),
  );
}

export function partitionQualityBaselineRepoScanPaths(paths: readonly string[]): {
  includedPaths: string[];
  ignoredPaths: string[];
} {
  const includedPaths: string[] = [];
  const ignoredPaths: string[] = [];

  for (const path of paths) {
    if (isQualityBaselineRepoScanIgnoredPath(path)) {
      ignoredPaths.push(path);
    } else {
      includedPaths.push(path);
    }
  }

  return { includedPaths, ignoredPaths };
}

function normalizeRepoScanPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runQualityBaseline();
}
