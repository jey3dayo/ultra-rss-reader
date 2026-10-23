import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as v from "valibot";
import { reactDoctorBaselines, reactDoctorFullScanTriageStatus } from "./react-doctor-triage.ts";
import type { ReactDoctorDiagnostic, ReactDoctorSummary } from "./react-doctor-schemas.ts";
import { parseReactDoctorDiagnostics, reactDoctorReportSchema } from "./react-doctor-schemas.ts";
import type { QualityToolDiagnostic } from "./tool-process.ts";
import {
  createProcessDiagnostic,
  exitCodeForDiagnostic,
  qualityToolTimeoutMs,
  writeToolDiagnostic,
} from "./tool-process.ts";

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

// Typed as readonly string[] rather than a literal tuple so an arbitrary severity string
// from the report can be looked up without a cast.
const reactDoctorSeverityOrder: readonly string[] = ["error", "warning"];

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

/**
 * Reads and parses a React Doctor JSON report from a file written by `--json-out`.
 * @param reportPath - Path to the JSON report file
 * @returns Parsed React Doctor report with diagnostics
 * @throws Error with details if the file cannot be read, parsed, or validated
 */
export function readReactDoctorJsonOutReport(reportPath: string): ReactDoctorReport {
  const reportJson = readFileSync(reportPath, "utf8");
  const parsed = JSON.parse(reportJson);
  const parseResult = v.safeParse(reactDoctorReportSchema, parsed);
  if (!parseResult.success) {
    throw new Error(`Invalid react-doctor report: ${parseResult.issues.map((i) => i.message).join(", ")}`);
  }
  return {
    ...parseResult.output,
    diagnostics: parseReactDoctorDiagnostics(
      parseResult.output.diagnostics.length > 0
        ? parseResult.output.diagnostics
        : (parseResult.output.projects?.flatMap((p) => p.diagnostics ?? []) ?? []),
    ),
  };
}

export function runReactDoctor(mode: ReactDoctorMode, failOnDrift: boolean): void {
  const scopeArgs = reactDoctorScopeArgs(mode);
  const reportPath = `tmp/react-doctor-${mode}.json`;
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
      "--json-out",
      reportPath,
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
    report = readReactDoctorJsonOutReport(reportPath);
  } catch (error) {
    const diagnostic: QualityToolDiagnostic = {
      kind: "malformed-report",
      tool: "React Doctor",
      command: "pnpm exec react-doctor",
      message: "Failed to parse react-doctor report",
      stderr: error instanceof Error ? error.message : String(error),
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

export function buildReactDoctorRuleCounts(diagnostics: readonly ReactDoctorDiagnostic[]): ReactDoctorRuleCount[] {
  const countsByKey = new Map<string, ReactDoctorRuleCount>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.severity} ${diagnostic.rule}`;
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

function checkEqual(name: string, actual: string | number | null, expected: string | number | null): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
}
