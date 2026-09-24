import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const qualityToolTimeoutMs = 120_000;

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
  // A measurement snapshot of the scan at scanSha, not a set of accepted risks: equal totals say
  // nothing about whether the findings were reviewed. Re-pin together with
  // reactDoctorFullScanTriageStatus.
  full: {
    score: null,
    errorCount: 2,
    warningCount: 31,
    affectedFileCount: 31,
  },
} as const;

// What was and was not triaged at the snapshot the full-scan constants describe. The
// counts are frozen scan-time figures, not a live count of what is currently
// unclassified: telling those apart needs a per-finding comparison against the record,
// which this wrapper does not do.
//
// classifiedWarningFamilies is the disposition table for every rule family other than
// classifiedRule, which is counted separately as classifiedFindingCount. Keep
// this table as the source of truth for those dispositions; untriagedWarningCountAtScan
// below is derived from it plus the complexity family so re-pinning warningCount never
// requires a hand-recomputed subtraction.
// Named so the empty array below keeps an element type. `as const` infers `readonly []` for a
// literal empty array, which makes the report loop over `never`.
type PendingJudgmentWarningFamily = {
  readonly rule: string;
  readonly count: number;
  readonly status: string;
  readonly trackingIssue: string;
};

const pendingJudgmentWarningFamilies: readonly PendingJudgmentWarningFamily[] = [];

const reactDoctorFullScanTriageStatusBase = {
  // The SHA must be reachable from main. A branch commit is not: squash-merging drops it,
  // and the pin then names a commit nobody can fetch to reproduce the measurement.
  //
  // It names the tree the scan ran against, and nothing more. What reproduces there is the raw
  // scan: warningCount, errorCount, affectedFileCount and auditWarningCount, by re-running
  // scanCommand and auditScanCommand at the pinned pluginVersion. The classification numbers below
  // are those diagnostics read through the *current* records, so this commit's own copy of the
  // block is deliberately outside the contract — do not compare them.
  scanSha: "42e307a17",
  pluginVersion: "0.9.14",
  scanCommand:
    "react-doctor . --verbose --project . --scope full --json --json-compact --blocking none --no-score --no-dead-code",
  classifiedRule: "no-high-complexity-react-function",
  // Rows in the record that this scan reports, not rows in the record: rows the scan no longer
  // reports stay in place, marked. scripts/check-react-doctor-pin-consistency.ts compares the sets.
  classifiedFindingCount: 24,
  classifiedRecordPath: "docs/react-doctor-complexity-classification.md",
  outlierIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/256",
  classifiedWarningFamilies: [
    {
      rule: "no-loading-flag-reset-outside-finally",
      count: 3,
      disposition: "false-positive",
      recordPath: ".claude/rules/react-doctor-triage.md (Loading Flag Reset Findings)",
    },
    {
      // Off by default in the pinned plugin. The disposition applies if it is turned back on.
      rule: "js-tosorted-immutable",
      count: 0,
      disposition: "false-positive",
      recordPath: ".claude/rules/code-policy.md (ES2023 Array Copy Methods)",
    },
    {
      // Off by default in the pinned plugin.
      rule: "js-combine-iterations",
      count: 0,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Iteration And Lookup Shape Findings)",
    },
    {
      rule: "js-set-map-lookups",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Iteration And Lookup Shape Findings)",
    },
    {
      rule: "no-self-updating-effect",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Behavioural Single Findings)",
    },
    {
      rule: "prefer-html-dialog",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Behavioural Single Findings)",
    },
    {
      // Removed from the pinned plugin's rule set. Counts must match the scan, so this stays 0.
      rule: "require-pnpm-hardening",
      count: 0,
      disposition: "deferred",
      recordPath: "https://github.com/jey3dayo/ultra-rss-reader/issues/264",
    },
    // Count 0 because every finding in these families carries an inline disable; the verdict
    // applies again if a disable is removed.
    {
      rule: "no-pass-data-to-parent",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-pass-live-state-to-parent",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-derived-state",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      // Only reported once no-derived-state is suppressed; see react-doctor-triage.md on the pairing.
      rule: "no-derived-state-effect",
      count: 0,
      disposition: "accepted-risk-and-false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-adjust-state-on-prop-change",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      // A second entry for the same rule because this finding has a different record.
      rule: "no-adjust-state-on-prop-change",
      count: 1,
      disposition: "accepted-risk",
      recordPath: ".claude/rules/react-doctor-triage.md (Adjust State On Prop Change Findings)",
    },
    {
      // Count 0 because no component trips the rule; the disposition applies if one grows back.
      rule: "no-giant-component",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-reset-all-state-on-prop-change",
      count: 0,
      disposition: "accepted-risk",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
    {
      rule: "no-secrets-in-client-code",
      count: 0,
      disposition: "false-positive",
      recordPath: "docs/react-doctor-warning-classification-300.md",
    },
  ],
  // Findings whose decision is blocked on something other than reading them. Kept out of
  // classifiedWarningFamilies so their count stays inside the untriaged total.
  pendingJudgmentWarningFamilies,
  // No open tracker while the untriaged total is 0; point this at a new issue when one is needed.
  untriagedWarningIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/256",
  errorIssue: "https://github.com/jey3dayo/ultra-rss-reader/issues/260",
  // The dispositions must total errorCountAtScan (pinned by the baseline test), so re-pinning
  // errorCount without re-classifying fails. mustFix counts fixes still owed.
  errorClassification: {
    pass: "2026-09-10",
    recordPath: "docs/react-doctor-error-triage.md",
    mustFix: 0,
    falsePositive: 1,
    acceptedRisk: 1,
  },
  // Named so re-pinning a total cannot erase an earlier decision.
  previouslyClassifiedErrors: [
    {
      rule: "no-prop-callback-in-render",
      location: "src/__tests__/components/story-query-client-provider.node.test.tsx:12",
      classification: "accepted-risk",
      reason:
        "Calls onClient during render, which the rule reports correctly. The call is a vi.fn QueryClient observation in a test helper, not a production state update; not re-confirmed in the 2026-09-08 pass.",
    },
  ],
  // The scanned warningCount is net of every inline disable, so on its own it cannot tell a
  // fixed finding from a silenced one. auditWarningCount is the same scan with
  // --no-respect-inline-disables, which is the number that moves only when a finding is
  // actually fixed. Re-pin the two together; measured on the same SHA as scanSha.
  auditWarningCount: 72,
  auditScanCommand:
    "react-doctor . --verbose --project . --scope full --json --json-compact --blocking none --no-score --no-dead-code --no-respect-inline-disables",
  reportArtifactPath: "tmp/react-doctor-full.json",
} as const;

const classifiedWarningFamiliesCount = reactDoctorFullScanTriageStatusBase.classifiedWarningFamilies.reduce(
  (total, family) => total + family.count,
  0,
);

// untriagedWarningCountAtScan is derived from the pinned totals so re-pinning never needs a
// hand-recomputed subtraction.
export const reactDoctorFullScanTriageStatus = {
  ...reactDoctorFullScanTriageStatusBase,
  classifiedWarningFamiliesCount,
  // Derived so there is no second pinned copy of the error total to drift.
  errorCountAtScan: reactDoctorBaselines.full.errorCount,
  untriagedWarningCountAtScan:
    reactDoctorBaselines.full.warningCount -
    reactDoctorFullScanTriageStatusBase.classifiedFindingCount -
    classifiedWarningFamiliesCount,
} as const;

// Per-finding classification: docs/knip-export-classification.md.
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

// Matched against the lockfile by name and major set, so an entry that matches nothing is dead
// data; remove it.
const knownAcceptableLockfileDuplicateMajors = [
  {
    name: "@vitest/spy",
    majors: [3, 5],
    reason:
      "Transitive Vitest 3 compatibility copy retained beside Vitest 5 by the current Storybook/Vitest toolchain.",
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
  // react-doctor sets this when a baseline run was asked for but the base could not be
  // resolved. Its own docs say the report then "lists every finding in the changed files
  // (mode downgrades to `diff`, the `baseline` block is dropped, the CI gate is skipped)".
  // Absent on a successful comparison, so an absent field is not a degraded run.
  baselineDegraded: boolean;
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
    command !== "lockfile-duplicate-majors"
  ) {
    console.error(
      "Usage: node scripts/quality-baseline.ts react-doctor:diff|react-doctor:full|knip|lockfile-duplicate-majors",
    );
    process.exit(2);
  }

  if (command === "react-doctor:diff") {
    runReactDoctor("diff", true);
  } else if (command === "react-doctor:full") {
    runReactDoctor("full", false);
  } else if (command === "knip") {
    runKnip();
  } else {
    runLockfileDuplicateMajorReport();
  }
}

// `changed` reports only findings new against the base. A finding inside a rewritten function
// still counts as new; clear it with the inline record in .claude/rules/react-doctor-triage.md,
// not a baseline bump. `--include-untracked` is required or a brand-new file passes unscanned.
export function reactDoctorScopeArgs(mode: ReactDoctorMode): string[] {
  if (mode === "diff") {
    return ["--scope", "changed", "--base", "origin/main", "--include-untracked"];
  }

  return ["--scope", "full"];
}

// Under `--scope changed` react-doctor reports `baseline` when it had a base to compare against
// and `diff` when the comparison produced nothing; both are the diff gate working.
export function isExpectedReactDoctorReportMode(mode: ReactDoctorMode, reportMode: string): boolean {
  if (mode === "diff") {
    return reportMode === "diff" || reportMode === "baseline";
  }

  return reportMode === "full";
}

// A degraded run lists every finding in the changed files, but its counts look like a delta.
// The notice names the missing comparison, not a cause: the report does not say which happened.
export function reactDoctorDegradedNotice(report: Pick<ReactDoctorReport, "baselineDegraded">): string | null {
  if (!report.baselineDegraded) {
    return null;
  }

  return "React Doctor reported no baseline comparison, so this run lists every finding in the changed files rather than only new ones.";
}

function runReactDoctor(mode: ReactDoctorMode, failOnDrift: boolean): void {
  const scopeArgs = reactDoctorScopeArgs(mode);
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "react-doctor",
      ".",
      "--verbose",
      // Scan only this repository's project: `react-doctor .` also discovers the gitignored
      // `apm_modules/` projects, which exist in some checkouts and not others.
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

  const degradedNotice = reactDoctorDegradedNotice(report);
  if (degradedNotice !== null) {
    console.log(degradedNotice);
  }

  if (mode === "full") {
    reportReactDoctorFullScanTriage(report, result.stdout);
  }

  const drift = [
    isExpectedReactDoctorReportMode(mode, report.mode)
      ? null
      : `mode drift: expected a ${mode} scan, actual ${report.mode}`,
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
    `  ${status.classifiedRule}: ${status.classifiedFindingCount} of this scan's findings are` +
      ` accepted-risk rows in ${status.classifiedRecordPath}; the outlier that record used to exclude` +
      ` was split and classified under ${status.outlierIssue}`,
  );
  console.log(
    `  additional classified warning families: ${status.classifiedWarningFamiliesCount} classified` +
      " (not part of the complexity family above; disposition recorded per rule)",
  );
  for (const family of status.classifiedWarningFamilies) {
    console.log(`    ${family.rule}: ${family.count} ${family.disposition}, recorded at ${family.recordPath}`);
  }
  for (const family of status.pendingJudgmentWarningFamilies) {
    console.log(
      `  ${family.rule} (${family.count}): ${family.status}; counted inside the untriaged total below,` +
        ` tracked at ${family.trackingIssue}`,
    );
  }
  console.log(
    `  other warnings: ${status.untriagedWarningCountAtScan} untriaged` +
      ` (= ${reactDoctorBaselines.full.warningCount} total − ${status.classifiedFindingCount} complexity −` +
      ` ${status.classifiedWarningFamiliesCount} additional families), tracked at ${status.untriagedWarningIssue}`,
  );
  const errorClassification = status.errorClassification;
  console.log(
    `  errors: ${status.errorCountAtScan} at scan time, all classified in the ${errorClassification.pass} pass` +
      ` recorded at ${errorClassification.recordPath}` +
      ` (${errorClassification.mustFix} must-fix, ${errorClassification.falsePositive} false-positive,` +
      ` ${errorClassification.acceptedRisk} accepted-risk); the must-fix fixes are tracked at ${status.errorIssue}`,
  );
  for (const entry of status.previouslyClassifiedErrors) {
    console.log(`    already ${entry.classification} before that pass: ${entry.rule} at ${entry.location}`);
  }
  console.log(
    `  Snapshot taken on ${status.scanSha} with oxlint-plugin-react-doctor ${status.pluginVersion};` +
      " a current untriaged count needs a per-finding comparison against the record, which this wrapper does not do.",
  );
  console.log(
    `  Inline disables hide ${status.auditWarningCount - reactDoctorBaselines.full.warningCount} of` +
      ` ${status.auditWarningCount} warnings at that snapshot. The count above is the suppressed view;` +
      " re-run with --no-respect-inline-disables to see what a fix would move.",
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
    baselineDegraded: parsed.baselineDegraded === true,
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

export function readLockfilePackages(lockfile: string): Map<string, LockfilePackageVersion[]> {
  const lockfileDocuments = lockfile.split(/^---[ \t]*(?:\r?\n|$)/m).filter((document) => document.trim().length > 0);
  // Why: pnpm 12 can put pnpm itself and platform-specific binaries in an environment
  // document before the dependency document. The final document owns application packages;
  // retaining the sole-document path keeps traditional lockfiles unchanged.
  const dependencyDocument = lockfileDocuments.at(-1) ?? lockfile;
  const packagesMatch = /^packages:[ \t]*$/m.exec(dependencyDocument);
  if (packagesMatch === null) {
    throw new Error("pnpm lockfile is missing a packages section.");
  }

  const versionsByPackageName = new Map<string, LockfilePackageVersion[]>();
  const packageKeyPattern = /^ {2}(?:"([^"]+)"|'([^']+)'|([^:\n]+)):/gm;
  const packagesSection = dependencyDocument.slice(packagesMatch.index);

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

function normalizeRepoScanPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

export function readJsonPayloads(stdout: string): string[] {
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
