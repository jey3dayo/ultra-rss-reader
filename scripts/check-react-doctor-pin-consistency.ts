import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { reactDoctorFullScanTriageStatus, readJsonPayloads } from "./quality-baseline.ts";

const qualityBaselineSourcePath = "scripts/quality-baseline.ts";
const scanTimeoutMs = 180_000;
const scanMaxBufferBytes = 64 * 1024 * 1024;

export type ReactDoctorScanDiagnostic = {
  rule: string;
  severity: string;
  normalizedFilePath: string;
  message: string;
};

export type ReactDoctorScanReport = {
  version: string;
  summary: {
    errorCount: number;
    warningCount: number;
    affectedFileCount: number;
  };
  diagnostics: ReactDoctorScanDiagnostic[];
};

// react-doctor can print log lines before the report; reuse quality-baseline.ts's
// brace-balancing payload reader rather than parsing stdout whole.
export function parseReactDoctorScanReport(stdout: string): ReactDoctorScanReport {
  let lastError: unknown;
  for (const payload of readJsonPayloads(stdout)) {
    try {
      return parseReactDoctorScanReportPayload(payload);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `react-doctor output contained no report object${lastError instanceof Error ? `: ${lastError.message}` : "."}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseReactDoctorScanReportPayload(payload: string): ReactDoctorScanReport {
  const parsed: unknown = JSON.parse(payload);
  if (!isRecord(parsed)) {
    throw new Error("react-doctor did not return a JSON object.");
  }

  const summary = parsed.summary;
  if (!isRecord(summary)) {
    throw new Error("react-doctor report is missing summary.");
  }

  const diagnostics = parsed.diagnostics;
  if (!Array.isArray(diagnostics)) {
    throw new Error("react-doctor report is missing diagnostics.");
  }

  return {
    version: readStringField(parsed, "version"),
    summary: {
      errorCount: readNumberField(summary, "errorCount"),
      warningCount: readNumberField(summary, "warningCount"),
      affectedFileCount: readNumberField(summary, "affectedFileCount"),
    },
    diagnostics: diagnostics.map(readScanDiagnostic),
  };
}

function readScanDiagnostic(entry: unknown): ReactDoctorScanDiagnostic {
  if (!isRecord(entry)) {
    throw new Error("react-doctor diagnostic entry is not an object.");
  }
  const record = entry;
  return {
    rule: readStringField(record, "rule"),
    severity: readStringField(record, "severity"),
    normalizedFilePath: readStringField(record, "normalizedFilePath"),
    message: readStringField(record, "message"),
  };
}

function readStringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string field "${key}" in react-doctor report.`);
  }
  return value;
}

function readNumberField(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number field "${key}" in react-doctor report.`);
  }
  return value;
}

// Excludes line/column: rows measurably drift to different lines across plugin versions
// while remaining the same finding, and react-doctor's `id` embeds both plus a content hash.
export type ComplexityFindingIdentity = {
  rule: string;
  normalizedFilePath: string;
  functionName: string;
};

export function complexityIdentityKey(identity: ComplexityFindingIdentity): string {
  return `${identity.rule}::${identity.normalizedFilePath}::${identity.functionName}`;
}

const complexityFunctionNamePattern = /^`([^`]+)`/;

export function extractComplexityFunctionName(message: string): string | null {
  const match = complexityFunctionNamePattern.exec(message);
  return match === null ? null : match[1];
}

export function buildScanComplexityIdentities(
  diagnostics: readonly ReactDoctorScanDiagnostic[],
  classifiedRule: string,
): ComplexityFindingIdentity[] {
  const identities: ComplexityFindingIdentity[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.rule !== classifiedRule) {
      continue;
    }
    const functionName = extractComplexityFunctionName(diagnostic.message);
    if (functionName === null) {
      throw new Error(`Could not extract a function name from a ${classifiedRule} message: ${diagnostic.message}`);
    }
    identities.push({ rule: classifiedRule, normalizedFilePath: diagnostic.normalizedFilePath, functionName });
  }
  return identities;
}

export type ClassificationRecordRow = {
  normalizedFilePath: string;
  functionName: string;
  classificationText: string;
  noLongerReported: boolean;
};

const noLongerReportedMarker = "(no longer reported:";
const recordLocationCellPattern = /^`([^`]+):\d+`$/;
const recordFunctionCellPattern = /^`([^`]+)`$/;

// Splits on unescaped "|" only; the Rationale column uses "\|\|" for literal `||`.
function splitMarkdownTableRow(line: string): string[] {
  const cells = line.split(/(?<!\\)\|/);
  if (cells.length > 0 && cells[0].trim() === "") {
    cells.shift();
  }
  if (cells.length > 0 && cells[cells.length - 1].trim() === "") {
    cells.pop();
  }
  return cells;
}

export function parseComplexityClassificationRecordRows(markdown: string): ClassificationRecordRow[] {
  const rows: ClassificationRecordRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = splitMarkdownTableRow(line);
    if (cells.length < 6) {
      continue;
    }

    const locationMatch = recordLocationCellPattern.exec(cells[0].trim());
    if (locationMatch === null) {
      continue;
    }
    const functionMatch = recordFunctionCellPattern.exec(cells[1].trim());
    if (functionMatch === null) {
      continue;
    }

    const classificationText = cells[5].trim();
    rows.push({
      normalizedFilePath: locationMatch[1],
      functionName: functionMatch[1],
      classificationText,
      noLongerReported: classificationText.includes(noLongerReportedMarker),
    });
  }
  return rows;
}

export type ComplexityIdentitySetComparison = {
  matchedCount: number;
  recordOnly: ComplexityFindingIdentity[];
  scanOnly: ComplexityFindingIdentity[];
};

export function compareComplexityIdentitySets(
  recordRows: readonly ClassificationRecordRow[],
  scanIdentities: readonly ComplexityFindingIdentity[],
  classifiedRule: string,
): ComplexityIdentitySetComparison {
  const activeRecordIdentities: ComplexityFindingIdentity[] = recordRows
    .filter((row) => !row.noLongerReported)
    .map((row) => ({
      rule: classifiedRule,
      normalizedFilePath: row.normalizedFilePath,
      functionName: row.functionName,
    }));

  const recordByKey = new Map(activeRecordIdentities.map((identity) => [complexityIdentityKey(identity), identity]));
  const scanByKey = new Map(scanIdentities.map((identity) => [complexityIdentityKey(identity), identity]));

  const recordOnly = [...recordByKey.entries()].filter(([key]) => !scanByKey.has(key)).map(([, identity]) => identity);
  const scanOnly = [...scanByKey.entries()].filter(([key]) => !recordByKey.has(key)).map(([, identity]) => identity);
  const matchedCount = [...recordByKey.keys()].filter((key) => scanByKey.has(key)).length;

  return { matchedCount, recordOnly, scanOnly };
}

export type WarningFamilyEntry = { rule: string; count: number };

export function sumWarningFamilyCounts(families: readonly WarningFamilyEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const family of families) {
    totals.set(family.rule, (totals.get(family.rule) ?? 0) + family.count);
  }
  return totals;
}

export function buildWarningRuleCounts(diagnostics: readonly ReactDoctorScanDiagnostic[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "warning") {
      continue;
    }
    counts.set(diagnostic.rule, (counts.get(diagnostic.rule) ?? 0) + 1);
  }
  return counts;
}

export type WarningFamilyCountMismatch = { rule: string; expected: number; actual: number };

export function findWarningFamilyCountMismatches(
  familyTotals: ReadonlyMap<string, number>,
  warningRuleCounts: ReadonlyMap<string, number>,
): WarningFamilyCountMismatch[] {
  const mismatches: WarningFamilyCountMismatch[] = [];
  for (const [rule, expected] of familyTotals) {
    const actual = warningRuleCounts.get(rule) ?? 0;
    if (actual !== expected) {
      mismatches.push({ rule, expected, actual });
    }
  }
  return mismatches;
}

export function findUnaccountedWarningRules(
  warningRuleCounts: ReadonlyMap<string, number>,
  accountedRuleNames: ReadonlySet<string>,
): string[] {
  return [...warningRuleCounts.keys()].filter((rule) => !accountedRuleNames.has(rule)).sort();
}

export type PinnedFullScanSummary = {
  errorCount: number;
  warningCount: number;
  affectedFileCount: number;
};

// affectedFileCount has no export to read; regex-extracting the pin avoids a second, driftable copy.
const pinnedFullScanSummaryPattern =
  /full:\s*\{\s*score:\s*null,\s*errorCount:\s*(\d+),\s*warningCount:\s*(\d+),\s*affectedFileCount:\s*(\d+),\s*\}/;

export function extractPinnedFullScanSummary(qualityBaselineSource: string): PinnedFullScanSummary {
  const match = pinnedFullScanSummaryPattern.exec(qualityBaselineSource);
  if (match === null) {
    throw new Error(`Could not find the pinned full-scan summary block in ${qualityBaselineSourcePath}.`);
  }
  return {
    errorCount: Number(match[1]),
    warningCount: Number(match[2]),
    affectedFileCount: Number(match[3]),
  };
}

export function checkAncestry(scanSha: string, resolvedCommit: string, isAncestor: boolean): string | null {
  if (isAncestor) {
    return null;
  }
  return `scanSha ${scanSha} (${resolvedCommit}) is not an ancestor of origin/main.`;
}

export function checkPluginVersion(reportVersion: string, pinnedVersion: string): string | null {
  if (reportVersion === pinnedVersion) {
    return null;
  }
  return `plugin version drift: scan reports ${reportVersion}, pinned pluginVersion is ${pinnedVersion}.`;
}

export function parseCommandTokens(command: string): string[] {
  return command.trim().split(/\s+/);
}

// The pinned commands target the repo root as "."; substitute it with the materialized tree.
export function buildMaterializedScanCommandArgs(command: string, targetDir: string): string[] {
  return parseCommandTokens(command).map((token) => (token === "." ? targetDir : token));
}

// --no-prune avoids deleting refs/remotes/origin/main under a global `fetch.prune = true`.
// --unshallow only when shallow: a CI checkout that already has that ref otherwise fetches
// nothing, leaving scanSha unreachable; a complete clone rejects --unshallow outright.
export function buildOriginMainFetchArgs(isShallow: boolean): string[] {
  return [
    "fetch",
    "--no-prune",
    "--force",
    ...(isShallow ? ["--unshallow"] : []),
    "origin",
    "main:refs/remotes/origin/main",
  ];
}

function fail(failures: string[]): never {
  console.error("React Doctor pin consistency check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

function formatIdentity(identity: ComplexityFindingIdentity): string {
  return `${identity.normalizedFilePath} :: ${identity.functionName}`;
}

function runGit(args: readonly string[]): void {
  execFileSync("git", [...args], { stdio: "inherit" });
}

function gitSucceeds(args: readonly string[]): boolean {
  const result = spawnSync("git", [...args], { stdio: "ignore" });
  return result.status === 0;
}

function isShallowRepository(): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Could not determine whether the repository is shallow: ${result.stderr.trim()}`);
  }
  return result.stdout.trim() === "true";
}

function resolveCommit(ref: string): string {
  const result = spawnSync("git", ["rev-parse", `${ref}^{commit}`], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Could not resolve scanSha "${ref}" to a commit: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function materializeTree(commit: string, workDir: string): string {
  const tarPath = join(workDir, "scan-tree.tar");
  const archiveResult = spawnSync("git", ["archive", commit], {
    encoding: "buffer",
    maxBuffer: scanMaxBufferBytes,
  });
  if (archiveResult.status !== 0) {
    throw new Error(`git archive ${commit} failed: ${archiveResult.stderr?.toString("utf8") ?? "unknown error"}`);
  }
  writeFileSync(tarPath, archiveResult.stdout);

  const extractDir = join(workDir, "tree");
  mkdirSync(extractDir, { recursive: true });
  const tarResult = spawnSync("tar", ["-x", "-f", tarPath, "-C", extractDir]);
  if (tarResult.status !== 0) {
    throw new Error(`tar extraction of ${commit} failed: ${tarResult.stderr?.toString("utf8") ?? "unknown error"}`);
  }
  return extractDir;
}

function runReactDoctorScan(command: string, targetDir: string): ReactDoctorScanReport {
  const args = ["exec", ...buildMaterializedScanCommandArgs(command, targetDir)];
  const result = spawnSync("pnpm", args, {
    encoding: "utf8",
    timeout: scanTimeoutMs,
    maxBuffer: scanMaxBufferBytes,
  });
  if (result.status !== 0) {
    throw new Error(
      `pnpm exec react-doctor against ${targetDir} exited with status ${result.status ?? "unknown"}: ${result.stderr}`,
    );
  }
  return parseReactDoctorScanReport(result.stdout);
}

function main(): void {
  const status = reactDoctorFullScanTriageStatus;
  const qualityBaselineSource = readFileSync(qualityBaselineSourcePath, "utf8");
  const pinnedSummary = extractPinnedFullScanSummary(qualityBaselineSource);

  const derivedPinnedWarningCount =
    status.untriagedWarningCountAtScan + status.classifiedFindingCount + status.classifiedWarningFamiliesCount;
  if (derivedPinnedWarningCount !== pinnedSummary.warningCount) {
    fail([
      `reactDoctorFullScanTriageStatus derives warningCount ${derivedPinnedWarningCount} but ` +
        `reactDoctorBaselines.full.warningCount in ${qualityBaselineSourcePath} is ${pinnedSummary.warningCount}.`,
    ]);
  }
  if (status.errorCountAtScan !== pinnedSummary.errorCount) {
    fail([
      `reactDoctorFullScanTriageStatus.errorCountAtScan is ${status.errorCountAtScan} but ` +
        `reactDoctorBaselines.full.errorCount in ${qualityBaselineSourcePath} is ${pinnedSummary.errorCount}.`,
    ]);
  }

  runGit(buildOriginMainFetchArgs(isShallowRepository()));
  const scanCommit = resolveCommit(status.scanSha);
  const isAncestor = gitSucceeds(["merge-base", "--is-ancestor", scanCommit, "refs/remotes/origin/main"]);
  const ancestryFailure = checkAncestry(status.scanSha, scanCommit, isAncestor);
  if (ancestryFailure !== null) {
    fail([ancestryFailure]);
  }

  const workDir = mkdtempSync(join(tmpdir(), "react-doctor-pin-"));
  let report: ReactDoctorScanReport;
  let auditWarningCount: number;
  try {
    const extractDir = materializeTree(scanCommit, workDir);
    report = runReactDoctorScan(status.scanCommand, extractDir);
    const auditReport = runReactDoctorScan(status.auditScanCommand, extractDir);
    auditWarningCount = auditReport.summary.warningCount;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  const failures: string[] = [];

  const pluginVersionFailure = checkPluginVersion(report.version, status.pluginVersion);
  if (pluginVersionFailure !== null) {
    failures.push(pluginVersionFailure);
  }
  if (report.summary.errorCount !== pinnedSummary.errorCount) {
    failures.push(
      `errorCount drift: scanSha reproduces ${report.summary.errorCount}, pinned value is ${pinnedSummary.errorCount}.`,
    );
  }
  if (report.summary.warningCount !== pinnedSummary.warningCount) {
    failures.push(
      `warningCount drift: scanSha reproduces ${report.summary.warningCount}, pinned value is ${pinnedSummary.warningCount}.`,
    );
  }
  if (report.summary.affectedFileCount !== pinnedSummary.affectedFileCount) {
    failures.push(
      `affectedFileCount drift: scanSha reproduces ${report.summary.affectedFileCount}, pinned value is ${pinnedSummary.affectedFileCount}.`,
    );
  }
  if (auditWarningCount !== status.auditWarningCount) {
    failures.push(
      `auditWarningCount drift: scanSha reproduces ${auditWarningCount}, pinned value is ${status.auditWarningCount}.`,
    );
  }

  const recordMarkdown = readFileSync(status.classifiedRecordPath, "utf8");
  const recordRows = parseComplexityClassificationRecordRows(recordMarkdown);
  const scanComplexityIdentities = buildScanComplexityIdentities(report.diagnostics, status.classifiedRule);
  const comparison = compareComplexityIdentitySets(recordRows, scanComplexityIdentities, status.classifiedRule);

  if (comparison.recordOnly.length > 0) {
    failures.push(
      `${status.classifiedRecordPath} has ${comparison.recordOnly.length} row(s) the scan no longer reports: ` +
        comparison.recordOnly.map(formatIdentity).join(", "),
    );
  }
  if (comparison.scanOnly.length > 0) {
    failures.push(
      `The scan reports ${comparison.scanOnly.length} ${status.classifiedRule} finding(s) with no row in ` +
        `${status.classifiedRecordPath}: ${comparison.scanOnly.map(formatIdentity).join(", ")}`,
    );
  }
  if (comparison.matchedCount !== status.classifiedFindingCount) {
    failures.push(
      `classifiedFindingCount is ${status.classifiedFindingCount}, but ${comparison.matchedCount} record row(s) match a scanned finding.`,
    );
  }

  const warningRuleCounts = buildWarningRuleCounts(report.diagnostics);
  const familyTotals = sumWarningFamilyCounts(status.classifiedWarningFamilies);
  const familyMismatches = findWarningFamilyCountMismatches(familyTotals, warningRuleCounts);
  for (const mismatch of familyMismatches) {
    failures.push(
      `classifiedWarningFamilies rule "${mismatch.rule}" is pinned at ${mismatch.expected}, but the scan reports ${mismatch.actual}.`,
    );
  }

  const pendingTotals = sumWarningFamilyCounts(status.pendingJudgmentWarningFamilies);
  const pendingMismatches = findWarningFamilyCountMismatches(pendingTotals, warningRuleCounts);
  for (const mismatch of pendingMismatches) {
    failures.push(
      `pendingJudgmentWarningFamilies rule "${mismatch.rule}" is pinned at ${mismatch.expected}, but the scan reports ${mismatch.actual}.`,
    );
  }

  const accountedRuleNames = new Set<string>([status.classifiedRule, ...familyTotals.keys(), ...pendingTotals.keys()]);
  const unaccountedRules = findUnaccountedWarningRules(warningRuleCounts, accountedRuleNames);
  if (unaccountedRules.length > 0) {
    failures.push(`The scan reports warning rule(s) with no classification: ${unaccountedRules.join(", ")}`);
  }

  const derivedUntriaged =
    report.summary.warningCount - status.classifiedFindingCount - status.classifiedWarningFamiliesCount;
  if (derivedUntriaged !== status.untriagedWarningCountAtScan) {
    failures.push(
      `untriagedWarningCountAtScan is pinned at ${status.untriagedWarningCountAtScan}, but ` +
        `warningCount (${report.summary.warningCount}) - classifiedFindingCount (${status.classifiedFindingCount}) - ` +
        `classifiedWarningFamiliesCount (${status.classifiedWarningFamiliesCount}) is ${derivedUntriaged}.`,
    );
  }

  if (failures.length > 0) {
    fail(failures);
  }

  console.log(
    `React Doctor pin consistency ok: scanSha ${status.scanSha} (${scanCommit}) reproduces ` +
      `errors=${report.summary.errorCount} warnings=${report.summary.warningCount} ` +
      `files=${report.summary.affectedFileCount} auditWarnings=${auditWarningCount}; ` +
      `${status.classifiedRule} identity set agrees (${comparison.matchedCount} rows).`,
  );
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}
