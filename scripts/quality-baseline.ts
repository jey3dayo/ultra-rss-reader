import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as v from "valibot";
import type { ReactDoctorDiagnostic, ReactDoctorPin, ReactDoctorSummary } from "./quality/react-doctor-schemas.ts";
import {
  parseReactDoctorDiagnostics,
  reactDoctorPinSchema,
  reactDoctorReportSchema,
} from "./quality/react-doctor-schemas.ts";

const qualityToolTimeoutMs = 120_000;

// Load react-doctor pin from JSON
function loadReactDoctorPin(): ReactDoctorPin {
  const pinJson = readFileSync("scripts/quality/react-doctor-pin.json", "utf8");
  return v.parse(reactDoctorPinSchema, JSON.parse(pinJson));
}

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

const reactDoctorPin = loadReactDoctorPin();
const reactDoctorBaselines = {
  diff: reactDoctorPin.diff,
  full: reactDoctorPin.full,
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
  scanSha: reactDoctorPin.scanSha,
  pluginVersion: reactDoctorPin.pluginVersion,
  scanCommand: reactDoctorPin.scanCommand,
  // Rows in the record that this scan reports, not rows in the record: rows the scan no longer
  // reports stay in place, marked. scripts/check-react-doctor-pin-consistency.ts compares the sets.
  classifiedFindingCount: 22,
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
  auditWarningCount: reactDoctorPin.auditWarningCount,
  auditScanCommand: reactDoctorPin.auditScanCommand,
  reportArtifactPath: "tmp/react-doctor-full.json",
  // classifiedRule is used in triage, not in the pin
  classifiedRule: "no-high-complexity-react-function",
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
  issueCount: 3,
  findingsCount: 3,
} as const;

type ReactDoctorMode = keyof typeof reactDoctorBaselines;

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

// Typed as readonly string[] rather than a literal tuple so an arbitrary severity string
// from the report can be looked up without a cast.
const reactDoctorSeverityOrder: readonly string[] = ["error", "warning"];

type KnipIssueBucket = Record<string, unknown>;

type KnipReport = {
  issues: KnipIssueBucket[];
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

  let report: ReactDoctorReport;
  try {
    const reportJson = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(reportJson);
    const parseResult = v.safeParse(reactDoctorReportSchema, parsed);
    if (!parseResult.success) {
      throw new Error(`Invalid react-doctor report: ${parseResult.issues.map((i) => i.message).join(", ")}`);
    }
    report = {
      ...parseResult.output,
      diagnostics: parseReactDoctorDiagnostics(
        parseResult.output.diagnostics.length > 0
          ? parseResult.output.diagnostics
          : (parseResult.output.projects?.flatMap((p) => p.diagnostics ?? []) ?? []),
      ),
    };
  } catch (error) {
    const diagnostic: QualityToolDiagnostic = {
      outcome: "report-invalid",
      stderr: error instanceof Error ? error.message : "Failed to parse react-doctor report",
    };
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
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
    reportReactDoctorFullScanTriage(report, reportPath);
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
function reportReactDoctorFullScanTriage(report: ReactDoctorReport, reportPath: string): void {
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

  console.log(`Every finding, with its file and message, is in ${reportPath}.`);

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

function runKnip(gate: boolean): void {
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
    const label = gate ? "Knip baseline delta:" : "Knip baseline delta (informational):";
    console.log([label, ...drift].join("\n"));
  }

  if (gate && (report.issues.length > knipBaseline.issueCount || findingsCount > knipBaseline.findingsCount)) {
    console.error(
      `Knip findings exceed baseline (issues ${report.issues.length}/${knipBaseline.issueCount}, findings ${findingsCount}/${knipBaseline.findingsCount}). Remove the unused code or update knipBaseline with a classification in docs/knip-export-classification.md.`,
    );
    process.exit(1);
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

export function parseReactDoctorReport(stdout: string): ReactDoctorReport {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      const parsed = JSON.parse(payload);
      const parseResult = v.safeParse(reactDoctorReportSchema, parsed);
      if (parseResult.success) {
        return {
          ...parseResult.output,
          diagnostics: parseReactDoctorDiagnostics(
            parseResult.output.diagnostics.length > 0
              ? parseResult.output.diagnostics
              : (parseResult.output.projects?.flatMap((p) => p.diagnostics ?? []) ?? []),
          ),
        };
      }
    } catch {}
  }
  throw new Error("React Doctor did not return a valid report JSON object.");
}

export function parseKnipReport(stdout: string): KnipReport {
  // Knip with --reporter json writes a single JSON line. Parse the last non-empty line.
  const lines = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim());
  const lastLine = lines[lines.length - 1];
  if (!lastLine) {
    throw new Error("Knip did not return any output.");
  }

  try {
    const parsed: unknown = JSON.parse(lastLine);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).issues)) {
      throw new Error("Knip did not return an issues array.");
    }
    return {
      issues: ((parsed as Record<string, unknown>).issues as unknown[]).filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item),
      ),
    };
  } catch (error) {
    throw new Error(
      `Knip did not return a valid report JSON object: ${error instanceof Error ? error.message : "parse failed"}`,
    );
  }
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

function checkEqual(name: string, actual: string | number | null, expected: string | number | null): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
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

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
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

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runQualityBaseline();
}
