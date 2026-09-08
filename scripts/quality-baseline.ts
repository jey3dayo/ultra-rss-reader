import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const qualityToolTimeoutMs = 120_000;
const qualityToolMaxBufferBytes = 64 * 1024 * 1024;

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
  rootMarkdownFiles: ["AGENTS.md", "CLAUDE.md", "README.md"],
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

export const testHelperRuntimeIsolationContract = {
  sharedSetupPath: "tests/setup.ts",
  policyTestPath: "tests/test-isolation-policy.node.test.ts",
  helperPathPrefixes: ["tests/helpers/"],
  suiteBoundaryResets: [
    "cleanup()",
    "teardownTauriMocks()",
    "resetTauriRuntimeFlags()",
    "vi.useRealTimers()",
    "restoreProcessEnv()",
    'clearWorkingStorage(readWorkingWindowStorage("localStorage"))',
    'clearWorkingStorage(readWorkingWindowStorage("sessionStorage"))',
    "restoreStorageDescriptors()",
    "resetTestObserverMocks()",
  ],
  globalRuntimeSurfaces: [
    "process.env",
    "localStorage",
    "sessionStorage",
    "fake timers",
    "Tauri IPC mocks",
    "observer globals",
    "singleton diagnostics reporters",
  ],
  reviewPolicy:
    "Helpers that mutate global runtime state must expose an explicit reset or rely on the shared suite teardown, with focused coverage for two consecutive test runs.",
} as const;

const reactDoctorBaselines = {
  diff: {
    score: null,
    errorCount: 0,
    warningCount: 0,
    affectedFileCount: 0,
  },
  // The full-scan numbers are a MEASUREMENT SNAPSHOT of the last scan, not a set of
  // accepted risks. Equality with them means "the totals still match what was measured
  // on 2026-09-08", and nothing at all about whether the findings behind them were
  // reviewed. Only no-high-complexity-react-function was classified in that pass, so
  // most of what these numbers cover is still untriaged; runReactDoctor prints the
  // per-rule breakdown and the outstanding-triage notice on every full run so a zero
  // delta never reads as approval. Keep reactDoctorFullScanTriageStatus in step when
  // re-pinning these, and see docs/react-doctor-complexity-classification.md for the
  // per-finding record and .claude/rules/quality-policy.md for the durable families.
  // The drop from the previous 14/120/74 pin has two separate causes and neither is a
  // suppression: PRs #259/#261/#262 removed real findings, and adding --project . stopped
  // the scan from counting vendored apm_modules projects, which had contributed one error
  // and inflated require-pnpm-hardening from 1 to 3 by re-reporting the same root file.
  full: {
    score: null,
    errorCount: 14,
    warningCount: 97,
    affectedFileCount: 64,
  },
} as const;

// What was and was not triaged at the snapshot the full-scan constants describe. The
// counts are frozen scan-time figures, not a live count of what is currently
// unclassified: telling those apart needs a per-finding comparison against the record,
// which this wrapper does not do.
export const reactDoctorFullScanTriageStatus = {
  scanSha: "c1183e67f",
  pluginVersion: "0.9.13",
  scanCommand:
    "react-doctor . --verbose --project . --scope full --json --json-compact --blocking none --no-score --no-dead-code",
  classifiedRule: "no-high-complexity-react-function",
  classifiedFindingCount: 26,
  classifiedRecordPath: "docs/react-doctor-complexity-classification.md",
  outlierIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/256",
  untriagedWarningCountAtScan: 71,
  untriagedWarningIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/249",
  errorCountAtScan: 14,
  errorIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/260",
  // Not every error is unreviewed. Issue #249 already classified one of them, and this
  // pass did not re-confirm it rather than finding it unclassified; the distinction
  // matters because re-pinning a total must not erase an earlier decision.
  previouslyClassifiedErrors: [
    {
      rule: "no-prop-callback-in-render",
      location: "src/__tests__/components/story-query-client-provider.node.test.tsx:12",
      classification: "accepted-risk",
      reason:
        "Calls onClient during render, which the rule reports correctly. The call is a vi.fn QueryClient observation in a test helper, not a production state update; not re-confirmed in the 2026-09-08 pass.",
    },
  ],
  reportArtifactPath: "tmp/react-doctor-full.json",
} as const;

// Re-pinned on 2026-09-08 after classifying every reported export and type; see
// docs/knip-export-classification.md for the per-finding record. The remaining 11 findings are
// 7 unused files with `mise` / Vite-alias consumers, 2 intentional semantic aliases, and 2 exports
// whose `export` keyword is itself the contract a test asserts.
const knipBaseline = {
  issueCount: 10,
  findingsCount: 11,
} as const;

const lockfileDuplicateMajorBaseline = {
  // Current direct duplicates are intentionally unreviewed until their
  // compatibility lanes are retired: jest-dom keeps a transitive v6 beside
  // the direct v7, while the TypeScript aliases expose v6 and v7 beside the
  // transitive v5 used by the remaining toolchain.
  duplicatePackageCount: 50,
  duplicateMajorCount: 104,
  directDuplicatePackageCount: 2,
  unreviewedDuplicatePackageCount: 46,
} as const;

export const dependencyLicenseInventoryContract = {
  reportPath: "tmp/dependency-license-inventory.json",
  pnpmCommand: ["pnpm", "licenses", "list", "--json"],
  cargoCommand: ["cargo", "metadata", "--manifest-path", "src-tauri/Cargo.toml", "--format-version", "1", "--locked"],
  requiredEcosystems: ["pnpm", "cargo"],
  reviewPolicy:
    "Review unknown and dual-license entries before release distribution; generated inventory artifacts stay under tmp/.",
} as const;

export const dependencyUpdateSmokeContract = {
  categories: ["query-caching", "store-equality", "tauri-api", "vite-dev-server", "test-runner"] as const,
  reviewPolicy:
    "Classify lockfile updates by runtime behavior before review; pure dev dependency updates need only the matching test-runner or Vite smoke.",
  packages: [
    { name: "@tanstack/react-query", category: "query-caching", smoke: "query cache boot/reload contract" },
    { name: "zustand", category: "store-equality", smoke: "store selector equality and persistence contract" },
    { name: "@tauri-apps/api", category: "tauri-api", smoke: "Tauri command/event wrapper contract" },
    { name: "@tauri-apps/plugin-updater", category: "tauri-api", smoke: "updater hook command boundary contract" },
    { name: "vite", category: "vite-dev-server", smoke: "Tauri dev Vite port and HMR contract" },
    { name: "vitest", category: "test-runner", smoke: "unit test environment and setup contract" },
    { name: "@vitest/browser", category: "test-runner", smoke: "browser-mode test runner contract" },
  ],
} as const;

export const tailwindArbitraryValuesInventoryContract = {
  sourcePathPrefixes: ["src/"],
  sourceFileExtensions: [".tsx", ".css"],
  ignoredPathPrefixes: ["src/__tests__/"],
  categories: ["layout-critical", "motion-critical", "z-index", "token-candidate", "one-off-allowed"],
  reviewPolicy:
    "Classify arbitrary values before tokenizing; repeated semantic color, elevation, spacing, and z-index values should become token candidates.",
} as const;

const knownAcceptableLockfileDuplicateMajors = [
  {
    name: "@vitest/expect",
    majors: [3, 4],
    reason: "Transitive Vitest 3 compatibility copy retained by the current Storybook/Vitest toolchain.",
  },
  {
    name: "@vitest/pretty-format",
    majors: [3, 4],
    reason: "Transitive Vitest 3 compatibility copy retained by the current Storybook/Vitest toolchain.",
  },
  {
    name: "@vitest/spy",
    majors: [3, 4],
    reason: "Transitive Vitest 3 compatibility copy retained by the current Storybook/Vitest toolchain.",
  },
  {
    name: "@vitest/utils",
    majors: [3, 4],
    reason: "Transitive Vitest 3 compatibility copy retained by the current Storybook/Vitest toolchain.",
  },
] as const;

type ReactDoctorMode = keyof typeof reactDoctorBaselines;

type ReactDoctorSummary = {
  score: number | null;
  errorCount: number;
  warningCount: number;
  affectedFileCount: number;
};

export type ReactDoctorDiagnostic = {
  severity: string;
  rule: string;
};

export type ReactDoctorRuleCount = ReactDoctorDiagnostic & {
  count: number;
};

type ReactDoctorReport = {
  version: string;
  mode: string;
  summary: ReactDoctorSummary;
  diagnostics: ReactDoctorDiagnostic[];
};

// A diagnostic with no readable rule or severity still has to appear in the breakdown.
// Dropping it would let an unnamed finding pass as reviewed, which is the failure the
// per-rule output exists to prevent.
const unknownReactDoctorRule = "(unknown rule)";
const unknownReactDoctorSeverity = "(unknown severity)";

// Typed as readonly string[] rather than a literal tuple so an arbitrary severity string
// from the report can be looked up without a cast.
const reactDoctorSeverityOrder: readonly string[] = ["error", "warning"];

type KnipIssueBucket = Record<string, unknown>;

type KnipReport = {
  issues: KnipIssueBucket[];
};

type PackageManifest = {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
};

type LockfilePackageVersion = {
  version: string;
  major: number;
};

export type LockfileDuplicateMajorEntry = {
  name: string;
  majors: number[];
  versions: string[];
  dependencyType: "direct" | "transitive";
  allowed: boolean;
  reason?: string;
};

export type LockfileDuplicateMajorReport = {
  duplicatePackageCount: number;
  duplicateMajorCount: number;
  directDuplicatePackageCount: number;
  unreviewedDuplicatePackageCount: number;
  entries: LockfileDuplicateMajorEntry[];
};

export type TailwindArbitraryValueCategory = (typeof tailwindArbitraryValuesInventoryContract.categories)[number];

export type TailwindArbitraryValueEntry = {
  path: string;
  line: number;
  className: string;
  value: string;
  category: TailwindArbitraryValueCategory;
};

export type TailwindArbitraryValueSummary = Record<TailwindArbitraryValueCategory, number>;

export type TailwindArbitraryValueInventory = {
  summary: TailwindArbitraryValueSummary;
  entries: TailwindArbitraryValueEntry[];
};

export type DependencyLicenseFinding = {
  ecosystem: "pnpm" | "cargo";
  packageName: string;
  version?: string;
  license: string;
  review: "ok" | "dual-license" | "unknown-license";
};

export type DependencyLicenseInventory = {
  generatedReportPath: string;
  ecosystems: Record<(typeof dependencyLicenseInventoryContract.requiredEcosystems)[number], number>;
  summary: {
    total: number;
    unknownLicenseCount: number;
    dualLicenseCount: number;
  };
  findings: DependencyLicenseFinding[];
};

export type QualityToolDiagnosticKind =
  | "missing-command"
  | "non-zero-exit"
  | "empty-report"
  | "malformed-report"
  | "process-error"
  | "timeout"
  | "signal";

export type QualityToolDiagnostic = {
  kind: QualityToolDiagnosticKind;
  tool: string;
  command: string;
  message: string;
  exitCode?: number;
  signal?: NodeJS.Signals;
  stderr?: string;
  stdout?: string;
};

export function runQualityBaseline(command: string | undefined = process.argv[2]): void {
  if (
    command !== "react-doctor:diff" &&
    command !== "react-doctor:full" &&
    command !== "knip" &&
    command !== "lockfile-duplicate-majors" &&
    command !== "tailwind-arbitrary-values" &&
    command !== "dependency-licenses"
  ) {
    console.error(
      "Usage: node scripts/quality-baseline.ts react-doctor:diff|react-doctor:full|knip|lockfile-duplicate-majors|tailwind-arbitrary-values|dependency-licenses",
    );
    process.exit(2);
  }

  if (command === "react-doctor:diff") {
    runReactDoctor("diff", true);
  } else if (command === "react-doctor:full") {
    runReactDoctor("full", false);
  } else if (command === "knip") {
    runKnip();
  } else if (command === "lockfile-duplicate-majors") {
    runLockfileDuplicateMajorReport();
  } else if (command === "tailwind-arbitrary-values") {
    runTailwindArbitraryValuesInventory();
  } else {
    runDependencyLicenseInventory();
  }
}

function runReactDoctor(mode: ReactDoctorMode, failOnDrift: boolean): void {
  const scopeArgs = mode === "diff" ? ["--scope", "files", "--base", "origin/main"] : ["--scope", "full"];
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "react-doctor",
      ".",
      "--verbose",
      // Pin the scan to this repository's own project. `react-doctor .` discovers every
      // project root beneath the working directory, and `apm_modules/` holds vendored
      // packages that are gitignored — present in a normal checkout, absent from a fresh
      // worktree. Scanning them made the same command report different totals depending
      // on which tree it ran in, and inflated project-level rules such as
      // require-pnpm-hardening, which then fired once per discovered project against the
      // single root pnpm-workspace.yaml. pnpm-workspace.yaml declares no `packages`, so
      // this repository has exactly one project and nothing legitimate is excluded.
      "--project",
      ".",
      ...scopeArgs,
      "--json",
      "--json-compact",
      "--blocking",
      "none",
      "--no-score",
      "--no-dead-code",
    ],
    { encoding: "utf8", timeout: qualityToolTimeoutMs },
  );

  const processDiagnostic = createProcessDiagnostic("React Doctor", "pnpm exec react-doctor", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const report = parseReactDoctorReportOrExit(result.stdout);
  const expected = reactDoctorBaselines[mode];

  const summary = [
    `React Doctor ${mode}: score=${report.summary.score}`,
    `errors=${report.summary.errorCount}`,
    `warnings=${report.summary.warningCount}`,
    `files=${report.summary.affectedFileCount}`,
  ].join(" ");
  console.log(summary);

  if (mode === "full") {
    reportReactDoctorFullScanTriage(report, result.stdout);
  }

  const drift = [
    checkEqual("mode", report.mode, mode),
    checkEqual("score", report.summary.score, expected.score),
    checkEqual("errorCount", report.summary.errorCount, expected.errorCount),
    checkEqual("warningCount", report.summary.warningCount, expected.warningCount),
    checkEqual("affectedFileCount", report.summary.affectedFileCount, expected.affectedFileCount),
  ].filter(Boolean);

  if (drift.length === 0) {
    return;
  }

  console.error(drift.join("\n"));
  if (failOnDrift) {
    process.exit(1);
  }
  console.error("Full scan drift is informational; update the baseline after triage.");
}

// The full-scan baseline compares totals only, so a zero delta says nothing about whether
// the findings were reviewed. Print the per-rule breakdown and the outstanding triage
// every run, drift or not, so equality can never be mistaken for approval.
function reportReactDoctorFullScanTriage(report: ReactDoctorReport, stdout: string): void {
  const status = reactDoctorFullScanTriageStatus;

  console.log("React Doctor full baseline is a measurement snapshot of the last scan, not a set of accepted risks.");
  console.log("Findings by severity and rule:");
  const ruleCounts = buildReactDoctorRuleCounts(report.diagnostics);
  if (ruleCounts.length === 0) {
    console.log("  (report carried no per-diagnostic detail)");
  }
  for (const entry of ruleCounts) {
    console.log(`  ${entry.severity} ${entry.rule}: ${entry.count}`);
  }

  const artifactPath = writeReactDoctorReportArtifact(stdout, status.reportArtifactPath);
  console.log(
    artifactPath === null
      ? "Every finding is in the scan output above; the report artifact could not be written."
      : `Every finding, with its file and message, is in ${artifactPath}.`,
  );

  console.log("Outstanding triage (counts are from the pinned scan, not a live count):");
  console.log(
    `  ${status.classifiedRule}: ${status.classifiedFindingCount} classified in ${status.classifiedRecordPath}` +
      ` (${status.classifiedFindingCount - 1} accepted-risk, 1 outlier tracked at ${status.outlierIssue})`,
  );
  console.log(
    `  other warnings: ${status.untriagedWarningCountAtScan} untriaged, tracked at ${status.untriagedWarningIssue}`,
  );
  console.log(
    `  errors: ${status.errorCountAtScan} at scan time, tracked at ${status.errorIssue}` +
      `; ${status.previouslyClassifiedErrors.length} of them already classified earlier and not re-confirmed in that pass`,
  );
  for (const entry of status.previouslyClassifiedErrors) {
    console.log(`    already ${entry.classification}: ${entry.rule} at ${entry.location}`);
  }
  console.log(
    `  Snapshot taken on ${status.scanSha} with oxlint-plugin-react-doctor ${status.pluginVersion};` +
      " a current untriaged count needs a per-finding comparison against the record, which this wrapper does not do.",
  );
  console.log(
    "  Totals only: an equal count can hide findings that were swapped for different ones, so this is not a general regression check.",
  );
}

function writeReactDoctorReportArtifact(stdout: string, reportPath: string): string | null {
  const payload = readReactDoctorReportPayload(stdout);
  if (payload === null) {
    return null;
  }

  try {
    mkdirSync("tmp", { recursive: true });
    writeFileSync(reportPath, `${payload}\n`);
    return reportPath;
  } catch {
    return null;
  }
}

function readReactDoctorReportPayload(stdout: string): string | null {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      readReactDoctorReport(JSON.parse(payload));
      return payload;
    } catch {}
  }

  return null;
}

function runKnip(): void {
  const actualVersion = readKnipVersion();
  const result = spawnSync("pnpm", ["exec", "knip", "--reporter", "json", "--no-exit-code", "--no-progress"], {
    encoding: "utf8",
    timeout: qualityToolTimeoutMs,
  });

  const processDiagnostic = createProcessDiagnostic("Knip", "pnpm exec knip", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const report = parseKnipReportOrExit(result.stdout);
  const findingsCount = report.issues.reduce((total, issue) => total + countIssueFindings(issue), 0);

  console.log(`Knip: issues=${report.issues.length} findings=${findingsCount} version=${actualVersion}`);
  for (const issue of report.issues) {
    console.log(`Knip issue: ${formatKnipIssue(issue)}`);
  }

  const drift = [
    checkEqual("issueCount", report.issues.length, knipBaseline.issueCount),
    checkEqual("findingsCount", findingsCount, knipBaseline.findingsCount),
  ].filter(Boolean);

  if (drift.length > 0) {
    console.log(["Knip baseline delta (informational):", ...drift].join("\n"));
  }
}

export function formatKnipIssue(issue: KnipIssueBucket): string {
  const file = typeof issue.file === "string" ? issue.file : "<unknown file>";
  const categories = Object.entries(issue).flatMap(([key, value]) => {
    if (key === "file" || !Array.isArray(value) || value.length === 0) {
      return [];
    }
    const entries: unknown[] = value;
    const names = entries.reduce<string[]>((names, entry) => {
      let name: string | undefined;
      if (typeof entry === "string") {
        name = entry;
      } else if (entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string") {
        name = entry.name;
      }
      // Knip reports an unused file with its own path as the entry name, which
      // would repeat the line prefix. Drop names that add nothing to the line.
      if (name !== undefined && name !== file) {
        names.push(name);
      }
      return names;
    }, []);
    return [names.length > 0 ? `${key}: ${names.join(", ")}` : key];
  });

  return categories.length > 0 ? `${file} ${categories.join(" ")}` : file;
}

function runLockfileDuplicateMajorReport(): void {
  const report = buildLockfileDuplicateMajorReport(
    readFileSync("pnpm-lock.yaml", "utf8"),
    JSON.parse(readFileSync("package.json", "utf8")) as PackageManifest,
  );

  console.log(
    [
      `Lockfile duplicate majors: packages=${report.duplicatePackageCount}`,
      `majors=${report.duplicateMajorCount}`,
      `direct=${report.directDuplicatePackageCount}`,
      `unreviewed=${report.unreviewedDuplicatePackageCount}`,
    ].join(" "),
  );
  for (const entry of report.entries) {
    const status = entry.allowed ? "allowed" : "unreviewed";
    console.log(
      `${status}: ${entry.name} majors=${entry.majors.join(",")} versions=${entry.versions.join(",")} ${entry.dependencyType}`,
    );
  }

  const drift = [
    checkEqual(
      "duplicatePackageCount",
      report.duplicatePackageCount,
      lockfileDuplicateMajorBaseline.duplicatePackageCount,
    ),
    checkEqual("duplicateMajorCount", report.duplicateMajorCount, lockfileDuplicateMajorBaseline.duplicateMajorCount),
    checkEqual(
      "directDuplicatePackageCount",
      report.directDuplicatePackageCount,
      lockfileDuplicateMajorBaseline.directDuplicatePackageCount,
    ),
    checkEqual(
      "unreviewedDuplicatePackageCount",
      report.unreviewedDuplicatePackageCount,
      lockfileDuplicateMajorBaseline.unreviewedDuplicatePackageCount,
    ),
  ].filter(Boolean);

  if (drift.length > 0) {
    console.error(drift.join("\n"));
    process.exit(1);
  }
}

function runTailwindArbitraryValuesInventory(): void {
  const result = spawnSync("git", ["ls-files", "src/**/*.tsx", "src/**/*.css"], {
    encoding: "utf8",
    timeout: qualityToolTimeoutMs,
  });
  const processDiagnostic = createProcessDiagnostic("Tailwind arbitrary values inventory", "git ls-files", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const files = result.stdout
    .split("\n")
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .filter(isTailwindArbitraryValueInventorySourcePath)
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
  const inventory = buildTailwindArbitraryValueInventory(files);

  console.log(
    [
      `Tailwind arbitrary values: total=${inventory.entries.length}`,
      ...tailwindArbitraryValuesInventoryContract.categories.map(
        (category) => `${category}=${inventory.summary[category]}`,
      ),
    ].join(" "),
  );

  for (const entry of inventory.entries) {
    console.log(`${entry.category}: ${entry.path}:${entry.line} ${entry.className}`);
  }
}

function runDependencyLicenseInventory(): void {
  const pnpmResult = spawnSync(
    dependencyLicenseInventoryContract.pnpmCommand[0],
    dependencyLicenseInventoryContract.pnpmCommand.slice(1),
    { encoding: "utf8", maxBuffer: qualityToolMaxBufferBytes, timeout: qualityToolTimeoutMs },
  );
  const pnpmDiagnostic = createProcessDiagnostic("pnpm license inventory", "pnpm licenses list --json", pnpmResult);
  if (pnpmDiagnostic !== null) {
    writeToolDiagnostic(pnpmDiagnostic);
    process.exit(exitCodeForDiagnostic(pnpmDiagnostic));
  }

  const cargoResult = spawnSync(
    dependencyLicenseInventoryContract.cargoCommand[0],
    dependencyLicenseInventoryContract.cargoCommand.slice(1),
    { encoding: "utf8", maxBuffer: qualityToolMaxBufferBytes, timeout: qualityToolTimeoutMs },
  );
  const cargoDiagnostic = createProcessDiagnostic(
    "Cargo license inventory",
    "cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --locked",
    cargoResult,
  );
  if (cargoDiagnostic !== null) {
    writeToolDiagnostic(cargoDiagnostic);
    process.exit(exitCodeForDiagnostic(cargoDiagnostic));
  }

  let inventory: DependencyLicenseInventory;
  try {
    inventory = buildDependencyLicenseInventory({
      pnpm: JSON.parse(readJsonPayload(pnpmResult.stdout)),
      cargo: JSON.parse(readJsonPayload(cargoResult.stdout)),
    });
  } catch (error) {
    const diagnostic = createReportDiagnostic(
      "Dependency license inventory",
      "pnpm licenses list --json && cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --locked",
      `${pnpmResult.stdout}\n${cargoResult.stdout}`,
      error,
    );
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }

  mkdirSync("tmp", { recursive: true });
  writeFileSync(dependencyLicenseInventoryContract.reportPath, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(
    [
      `Dependency licenses: total=${inventory.summary.total}`,
      `pnpm=${inventory.ecosystems.pnpm}`,
      `cargo=${inventory.ecosystems.cargo}`,
      `unknown=${inventory.summary.unknownLicenseCount}`,
      `dual=${inventory.summary.dualLicenseCount}`,
      `report=${inventory.generatedReportPath}`,
    ].join(" "),
  );
}

export function buildLockfileDuplicateMajorReport(
  lockfile: string,
  manifest: PackageManifest,
): LockfileDuplicateMajorReport {
  const directDependencyNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const versionsByPackageName = readLockfilePackages(lockfile);
  const entries: LockfileDuplicateMajorEntry[] = [];

  for (const [name, versions] of [...versionsByPackageName.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const majors = [...new Set(versions.map((entry) => entry.major))].sort((left, right) => left - right);
    if (majors.length < 2) {
      continue;
    }

    const allowlistEntry = knownAcceptableLockfileDuplicateMajors.find(
      (entry) => entry.name === name && sameNumberList(entry.majors, majors),
    );
    entries.push({
      name,
      majors,
      versions: [...new Set(versions.map((entry) => entry.version))].sort(compareSemverLike),
      dependencyType: directDependencyNames.has(name) ? "direct" : "transitive",
      allowed: allowlistEntry !== undefined,
      reason: allowlistEntry?.reason,
    });
  }

  return {
    duplicatePackageCount: entries.length,
    duplicateMajorCount: entries.reduce((total, entry) => total + entry.majors.length, 0),
    directDuplicatePackageCount: entries.filter((entry) => entry.dependencyType === "direct").length,
    unreviewedDuplicatePackageCount: entries.filter((entry) => !entry.allowed).length,
    entries,
  };
}

export function buildTailwindArbitraryValueInventory(
  files: readonly { path: string; source: string }[],
): TailwindArbitraryValueInventory {
  const entries = files
    .flatMap((file) =>
      isTailwindArbitraryValueInventorySourcePath(file.path)
        ? readTailwindArbitraryValueEntries(file.path, file.source)
        : [],
    )
    .sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);

  const summary = createEmptyTailwindArbitraryValueSummary();
  for (const entry of entries) {
    summary[entry.category] += 1;
  }

  return { summary, entries };
}

export function buildDependencyLicenseInventory(reports: {
  pnpm: unknown;
  cargo: unknown;
}): DependencyLicenseInventory {
  const findings = [...readPnpmLicenseFindings(reports.pnpm), ...readCargoLicenseFindings(reports.cargo)].sort(
    (left, right) =>
      left.ecosystem.localeCompare(right.ecosystem) ||
      left.packageName.localeCompare(right.packageName) ||
      (left.version ?? "").localeCompare(right.version ?? ""),
  );

  return {
    generatedReportPath: dependencyLicenseInventoryContract.reportPath,
    ecosystems: {
      pnpm: findings.filter((finding) => finding.ecosystem === "pnpm").length,
      cargo: findings.filter((finding) => finding.ecosystem === "cargo").length,
    },
    summary: {
      total: findings.length,
      unknownLicenseCount: findings.filter((finding) => finding.review === "unknown-license").length,
      dualLicenseCount: findings.filter((finding) => finding.review === "dual-license").length,
    },
    findings,
  };
}

function readPnpmLicenseFindings(report: unknown): DependencyLicenseFinding[] {
  if (!isObject(report)) {
    throw new Error("pnpm licenses did not return a JSON object.");
  }

  return Object.entries(report).flatMap(([license, value]) => {
    const entries = Array.isArray(value) ? value : [];
    return entries.flatMap((entry) => {
      if (!isObject(entry)) {
        return [];
      }
      const packageName = readString(entry, "name");
      return [
        {
          ecosystem: "pnpm" as const,
          packageName,
          version:
            readOptionalString(entry, "version") ??
            readOptionalStringArray(entry, "versions")?.join(",") ??
            readPackageVersionSuffix(packageName),
          license,
          review: classifyLicenseReview(license),
        },
      ];
    });
  });
}

function readCargoLicenseFindings(report: unknown): DependencyLicenseFinding[] {
  const packages = Array.isArray(report)
    ? report
    : isObject(report) && Array.isArray(report.packages)
      ? report.packages
      : null;
  if (packages === null) {
    throw new Error("Cargo metadata did not return a packages array.");
  }

  return packages.flatMap((entry) => {
    if (!isObject(entry)) {
      return [];
    }
    const license = readOptionalString(entry, "license") ?? readOptionalString(entry, "license_file") ?? "UNKNOWN";
    return [
      {
        ecosystem: "cargo" as const,
        packageName: readString(entry, "name"),
        version: readOptionalString(entry, "version"),
        license,
        review: classifyLicenseReview(license),
      },
    ];
  });
}

function classifyLicenseReview(license: string): DependencyLicenseFinding["review"] {
  const normalizedLicense = license.trim();
  if (normalizedLicense.length === 0 || /^unknown$/i.test(normalizedLicense) || /no license/i.test(normalizedLicense)) {
    return "unknown-license";
  }
  if (/\b(?:OR|AND)\b|\//.test(normalizedLicense)) {
    return "dual-license";
  }
  return "ok";
}

function readPackageVersionSuffix(packageName: string): string | undefined {
  const separatorIndex = packageName.startsWith("@") ? packageName.indexOf("@", 1) : packageName.lastIndexOf("@");
  return separatorIndex === -1 ? undefined : packageName.slice(separatorIndex + 1);
}

export function isTailwindArbitraryValueInventorySourcePath(filePath: string): boolean {
  const normalizedPath = normalizeRepoScanPath(filePath);
  return (
    tailwindArbitraryValuesInventoryContract.sourcePathPrefixes.some((prefix) => normalizedPath.startsWith(prefix)) &&
    tailwindArbitraryValuesInventoryContract.sourceFileExtensions.some((extension) =>
      normalizedPath.endsWith(extension),
    ) &&
    !tailwindArbitraryValuesInventoryContract.ignoredPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix)) &&
    !isQualityBaselineRepoScanIgnoredPath(normalizedPath)
  );
}

export function classifyTailwindArbitraryValue(className: string): TailwindArbitraryValueCategory {
  const normalizedClassName = stripTailwindVariants(className);
  const value = readTailwindArbitraryValue(className);

  if (/^z-\[/.test(normalizedClassName)) {
    return "z-index";
  }
  if (/^(?:duration|delay|ease|animate)-\[/.test(normalizedClassName)) {
    return "motion-critical";
  }
  if (/^(?:bg|text|border|ring|fill|stroke|shadow|accent|caret|decoration)-\[/.test(normalizedClassName)) {
    return "token-candidate";
  }
  if (/var\(--|color-mix\(|oklch\(|rgba?\(|hsla?\(/.test(value)) {
    return "token-candidate";
  }
  if (
    /^(?:w|h|size|min-w|min-h|max-w|max-h|inset|top|right|bottom|left|translate-x|translate-y|grid-cols|grid-rows|col|row|gap|space|m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl|basis|aspect|leading|tracking|rounded)-\[/.test(
      normalizedClassName,
    )
  ) {
    return "layout-critical";
  }

  return "one-off-allowed";
}

function readKnipVersion(): string {
  const result = spawnSync("pnpm", ["exec", "knip", "--version"], {
    encoding: "utf8",
    timeout: qualityToolTimeoutMs,
  });

  const processDiagnostic = createProcessDiagnostic("Knip", "pnpm exec knip --version", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const version = lines.find((line) => /^\d+\.\d+\.\d+$/.test(line));
  if (version === undefined) {
    const diagnostic = createReportDiagnostic(
      "Knip",
      "pnpm exec knip --version",
      result.stdout,
      "Could not read Knip version.",
    );
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
  return version;
}

export function parseReactDoctorReport(stdout: string): ReactDoctorReport {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      const parsed: unknown = JSON.parse(payload);
      return readReactDoctorReport(parsed);
    } catch {}
  }

  throw new Error("React Doctor did not return a valid report JSON object.");
}

function readReactDoctorReport(parsed: unknown): ReactDoctorReport {
  if (!isObject(parsed)) {
    throw new Error("React Doctor did not return a JSON object.");
  }

  const summary = parsed.summary;
  if (!isObject(summary)) {
    throw new Error("React Doctor report is missing summary.");
  }

  return {
    version: readString(parsed, "version"),
    mode: readString(parsed, "mode"),
    summary: {
      score: readNullableNumber(summary, "score"),
      errorCount: readNumber(summary, "errorCount"),
      warningCount: readNumber(summary, "warningCount"),
      affectedFileCount: readNumber(summary, "affectedFileCount"),
    },
    diagnostics: readReactDoctorDiagnostics(parsed),
  };
}

// React Doctor reports diagnostics at the top level and repeats them per project. Prefer
// the top-level array and fall back to the per-project ones so the breakdown survives a
// report shape that only carries the latter.
function readReactDoctorDiagnostics(parsed: Record<string, unknown>): ReactDoctorDiagnostic[] {
  const topLevel = parsed.diagnostics;
  if (Array.isArray(topLevel)) {
    return readReactDoctorDiagnosticList(topLevel);
  }

  const projects = parsed.projects;
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects.flatMap((project) => {
    if (!isObject(project)) {
      return [];
    }
    const diagnostics = project.diagnostics;
    return Array.isArray(diagnostics) ? readReactDoctorDiagnosticList(diagnostics) : [];
  });
}

function readReactDoctorDiagnosticList(entries: readonly unknown[]): ReactDoctorDiagnostic[] {
  return entries.flatMap((entry) => (isObject(entry) ? [readReactDoctorDiagnostic(entry)] : []));
}

function readReactDoctorDiagnostic(entry: Record<string, unknown>): ReactDoctorDiagnostic {
  return {
    severity: readOptionalString(entry, "severity") ?? unknownReactDoctorSeverity,
    rule: readOptionalString(entry, "rule") ?? unknownReactDoctorRule,
  };
}

// Stable order: known severities first in escalation order, then any unknown severity
// alphabetically; within a severity, most frequent first, then rule name.
export function buildReactDoctorRuleCounts(diagnostics: readonly ReactDoctorDiagnostic[]): ReactDoctorRuleCount[] {
  const countsByKey = new Map<string, ReactDoctorRuleCount>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.severity} ${diagnostic.rule}`;
    const existing = countsByKey.get(key);
    if (existing === undefined) {
      countsByKey.set(key, { severity: diagnostic.severity, rule: diagnostic.rule, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  return [...countsByKey.values()].sort(
    (left, right) =>
      compareReactDoctorSeverity(left.severity, right.severity) ||
      right.count - left.count ||
      left.rule.localeCompare(right.rule),
  );
}

function compareReactDoctorSeverity(left: string, right: string): number {
  const leftRank = reactDoctorSeverityOrder.indexOf(left);
  const rightRank = reactDoctorSeverityOrder.indexOf(right);
  const leftOrder = leftRank === -1 ? reactDoctorSeverityOrder.length : leftRank;
  const rightOrder = rightRank === -1 ? reactDoctorSeverityOrder.length : rightRank;
  return leftOrder - rightOrder || left.localeCompare(right);
}

export function parseKnipReport(stdout: string): KnipReport {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      const parsed: unknown = JSON.parse(payload);
      return readKnipReport(parsed);
    } catch {}
  }

  throw new Error("Knip did not return a valid report JSON object.");
}

function readKnipReport(parsed: unknown): KnipReport {
  if (!isObject(parsed) || !Array.isArray(parsed.issues)) {
    throw new Error("Knip did not return an issues array.");
  }
  return {
    issues: parsed.issues.filter(isObject),
  };
}

export function createProcessDiagnostic(
  tool: string,
  command: string,
  result: SpawnSyncReturns<string>,
): QualityToolDiagnostic | null {
  const stdout = trimOptional(result.stdout);
  const stderr = trimOptional(result.stderr);
  const errorCode = readErrorCode(result.error);

  if (errorCode === "ENOENT") {
    return {
      kind: "missing-command",
      tool,
      command,
      message: `${tool} command could not be started.`,
      stderr,
      stdout,
    };
  }

  if (errorCode === "ETIMEDOUT") {
    return {
      kind: "timeout",
      tool,
      command,
      message: `${tool} command timed out after ${qualityToolTimeoutMs}ms.`,
      signal: result.signal ?? undefined,
      stderr,
      stdout,
    };
  }

  if (result.error !== undefined) {
    return {
      kind: "process-error",
      tool,
      command,
      message: `${tool} command failed before producing a report.`,
      stderr: trimOptional(result.error.message) ?? stderr,
      stdout,
    };
  }

  if (result.signal !== null) {
    return {
      kind: "signal",
      tool,
      command,
      message: `${tool} command was terminated by ${result.signal}.`,
      signal: result.signal,
      stderr,
      stdout,
    };
  }

  if (result.status !== 0) {
    return {
      kind: "non-zero-exit",
      tool,
      command,
      message: `${tool} command exited with status ${result.status ?? "unknown"}.`,
      exitCode: result.status ?? undefined,
      stderr,
      stdout,
    };
  }

  return null;
}

export function createReportDiagnostic(
  tool: string,
  command: string,
  stdout: string,
  error: unknown,
): QualityToolDiagnostic {
  const hasOutput = stdout.trim().length > 0;
  return {
    kind: hasOutput ? "malformed-report" : "empty-report",
    tool,
    command,
    message: hasOutput
      ? `${tool} returned output, but no valid report JSON could be parsed.`
      : `${tool} returned an empty report.`,
    stdout: trimOptional(stdout),
    stderr: error instanceof Error ? error.message : undefined,
  };
}

function countIssueFindings(issue: KnipIssueBucket): number {
  return Object.entries(issue).reduce((total, [key, value]) => {
    if (key === "file" || !Array.isArray(value)) {
      return total;
    }
    return total + value.length;
  }, 0);
}

function readLockfilePackages(lockfile: string): Map<string, LockfilePackageVersion[]> {
  const packagesStart = lockfile.indexOf("\npackages:\n");
  if (packagesStart === -1) {
    throw new Error("pnpm lockfile is missing a packages section.");
  }

  const versionsByPackageName = new Map<string, LockfilePackageVersion[]>();
  const packageKeyPattern = /^ {2}(?:"([^"]+)"|'([^']+)'|([^:\n]+)):/gm;
  const packagesSection = lockfile.slice(packagesStart);

  for (const match of packagesSection.matchAll(packageKeyPattern)) {
    const packageKey = match[1] ?? match[2] ?? match[3];
    if (packageKey === undefined) {
      continue;
    }

    const packageVersion = readLockfilePackageVersion(packageKey.trim());
    if (packageVersion === null) {
      continue;
    }

    const versions = versionsByPackageName.get(packageVersion.name) ?? [];
    versions.push({ version: packageVersion.version, major: packageVersion.major });
    versionsByPackageName.set(packageVersion.name, versions);
  }

  return versionsByPackageName;
}

function readLockfilePackageVersion(packageKey: string): { name: string; version: string; major: number } | null {
  const keyWithoutPeerSuffix = packageKey.replace(/^\//, "").split("(")[0];
  const versionSeparatorIndex = keyWithoutPeerSuffix.startsWith("@")
    ? keyWithoutPeerSuffix.indexOf("@", 1)
    : keyWithoutPeerSuffix.indexOf("@");
  if (versionSeparatorIndex === -1) {
    return null;
  }

  const version = keyWithoutPeerSuffix.slice(versionSeparatorIndex + 1);
  const majorText = /^\d+/.exec(version)?.[0];
  if (majorText === undefined) {
    return null;
  }

  return {
    name: keyWithoutPeerSuffix.slice(0, versionSeparatorIndex),
    version,
    major: Number(majorText),
  };
}

function compareSemverLike(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  return left.localeCompare(right);
}

function sameNumberList(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function readJsonPayload(stdout: string): string {
  const [payload] = readJsonPayloads(stdout);
  if (payload !== undefined) {
    return payload;
  }

  throw new Error("Tool output did not contain a JSON object.");
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

function readTailwindArbitraryValueEntries(path: string, source: string): TailwindArbitraryValueEntry[] {
  const entries: TailwindArbitraryValueEntry[] = [];
  const tokenPattern = /[^\s"'`<>]+/g;

  for (const match of source.matchAll(tokenPattern)) {
    const className = cleanPotentialTailwindToken(match[0]);
    if (!isTailwindArbitraryToken(className)) {
      continue;
    }
    const offset = match.index ?? 0;
    entries.push({
      path: normalizeRepoScanPath(path),
      line: countLinesBeforeOffset(source, offset) + 1,
      className,
      value: readTailwindArbitraryValue(className),
      category: classifyTailwindArbitraryValue(className),
    });
  }

  return entries;
}

function cleanPotentialTailwindToken(token: string): string {
  return token.replace(/^[{(]+/, "").replace(/[}),;]+$/, "");
}

function isTailwindArbitraryToken(token: string): boolean {
  if (!token.includes("[") || !token.includes("]")) {
    return false;
  }
  return stripTailwindVariants(token).includes("-[") || token.includes("]:");
}

function stripTailwindVariants(className: string): string {
  const bracketDepthAwareSeparator = /:(?![^[]*\])/g;
  return className.split(bracketDepthAwareSeparator).at(-1) ?? className;
}

function readTailwindArbitraryValue(className: string): string {
  const start = className.indexOf("[");
  const end = className.lastIndexOf("]");
  if (start === -1 || end <= start) {
    return "";
  }
  return className.slice(start + 1, end);
}

function createEmptyTailwindArbitraryValueSummary(): TailwindArbitraryValueSummary {
  return {
    "layout-critical": 0,
    "motion-critical": 0,
    "z-index": 0,
    "token-candidate": 0,
    "one-off-allowed": 0,
  };
}

function countLinesBeforeOffset(source: string, offset: number): number {
  let lines = 0;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      lines += 1;
    }
  }
  return lines;
}

function normalizeRepoScanPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function readJsonPayloads(stdout: string): string[] {
  const payloads: string[] = [];
  for (let start = stdout.indexOf("{"); start !== -1; start = stdout.indexOf("{", start + 1)) {
    const payload = readBalancedJsonObject(stdout, start);
    if (payload === null) {
      continue;
    }

    try {
      JSON.parse(payload);
      payloads.push(payload);
    } catch {}
  }

  return payloads;
}

function readBalancedJsonObject(stdout: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < stdout.length; index += 1) {
    const char = stdout[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return stdout.slice(start, index + 1);
      }
    }
  }

  return null;
}

function readNullableNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "number") {
    throw new Error(`Expected number or null at ${key}.`);
  }
  return value;
}

function checkEqual(name: string, actual: string | number | null, expected: string | number | null): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
}

function parseReactDoctorReportOrExit(stdout: string): ReactDoctorReport {
  try {
    return parseReactDoctorReport(stdout);
  } catch (error) {
    const diagnostic = createReportDiagnostic("React Doctor", "pnpm exec react-doctor", stdout, error);
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
}

function parseKnipReportOrExit(stdout: string): KnipReport {
  try {
    return parseKnipReport(stdout);
  } catch (error) {
    const diagnostic = createReportDiagnostic("Knip", "pnpm exec knip", stdout, error);
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
}

function writeToolDiagnostic(diagnostic: QualityToolDiagnostic): void {
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
}

function exitCodeForDiagnostic(diagnostic: QualityToolDiagnostic): number {
  if (diagnostic.kind === "missing-command") {
    return 127;
  }
  if (diagnostic.kind === "timeout") {
    return 124;
  }
  return diagnostic.exitCode ?? 1;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorCode(error: Error | undefined): string | undefined {
  if (error === undefined || !hasErrorCode(error) || typeof error.code !== "string") {
    return undefined;
  }
  return error.code;
}

function hasErrorCode(error: Error): error is Error & { code: unknown } {
  return "code" in error;
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${key}.`);
  }
  return value;
}

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function readOptionalStringArray(source: Record<string, unknown>, key: string): string[] | undefined {
  const value = source[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number at ${key}.`);
  }
  return value;
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runQualityBaseline();
}
