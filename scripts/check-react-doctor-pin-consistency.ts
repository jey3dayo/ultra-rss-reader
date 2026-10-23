import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as v from "valibot";
import {
  buildScanComplexityIdentities,
  buildWarningRuleCounts,
  type ComplexityFindingIdentity,
  checkAncestry,
  checkPluginVersion,
  compareComplexityIdentitySets,
  findUnaccountedWarningRules,
  findWarningFamilyCountMismatches,
  parseComplexityClassificationRecordRows,
  type ReactDoctorScanReport,
  sumWarningFamilyCounts,
} from "./quality/react-doctor-classification.ts";
import type { ReactDoctorPin } from "./quality/react-doctor-schemas.ts";
import { reactDoctorPinSchema, updateReactDoctorPin } from "./quality/react-doctor-schemas.ts";
import { reactDoctorFullScanTriageStatus } from "./quality/react-doctor-triage.ts";

const reactDoctorPinPath = "scripts/quality/react-doctor-pin.json";
const scanTimeoutMs = 180_000;
const scanMaxBufferBytes = 64 * 1024 * 1024;

function loadReactDoctorPin(): ReactDoctorPin {
  const pinJson = readFileSync(reactDoctorPinPath, "utf8");
  return v.parse(reactDoctorPinSchema, JSON.parse(pinJson));
}

type PinnedFullScanSummary = {
  errorCount: number;
  warningCount: number;
  affectedFileCount: number;
};

function loadPinnedFullScanSummary(): PinnedFullScanSummary {
  const pin = loadReactDoctorPin();
  return {
    errorCount: pin.full.errorCount,
    warningCount: pin.full.warningCount,
    affectedFileCount: pin.full.affectedFileCount,
  };
}

export function parseCommandTokens(command: string): string[] {
  return command.trim().split(/\s+/);
}

export function buildMaterializedScanCommandArgs(command: string, targetDir: string): string[] {
  return parseCommandTokens(command).map((token) => (token === "." ? targetDir : token));
}

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

function repin(): void {
  const status = reactDoctorFullScanTriageStatus;

  console.log(`Re-pinning react-doctor baseline at ${status.scanSha}...`);

  runGit(buildOriginMainFetchArgs(isShallowRepository()));
  const scanCommit = resolveCommit(status.scanSha);
  const isAncestor = gitSucceeds(["merge-base", "--is-ancestor", scanCommit, "refs/remotes/origin/main"]);
  const ancestryFailure = checkAncestry(status.scanSha, scanCommit, isAncestor);
  if (ancestryFailure !== null) {
    fail([ancestryFailure]);
  }

  const workDir = mkdtempSync(join(tmpdir(), "react-doctor-repin-"));
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

  const originalJson = JSON.parse(readFileSync(reactDoctorPinPath, "utf8"));

  const updatedPin = updateReactDoctorPin(originalJson, {
    pluginVersion: report.version,
    fullSummary: report.summary,
    auditWarningCount,
  });

  const pinJson = JSON.stringify(updatedPin, null, 2);
  writeFileSync(reactDoctorPinPath, `${pinJson}\n`);

  console.log(`✓ Updated ${reactDoctorPinPath}`);
  console.log(`  pluginVersion: ${updatedPin.pluginVersion}`);
  console.log(`  full.errorCount: ${updatedPin.full.errorCount}`);
  console.log(`  full.warningCount: ${updatedPin.full.warningCount}`);
  console.log(`  full.affectedFileCount: ${updatedPin.full.affectedFileCount}`);
  console.log(`  auditWarningCount: ${updatedPin.auditWarningCount}`);
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
  const reportPath = join(tmpdir(), `react-doctor-scan-${Date.now()}.json`);
  const args = ["exec", ...buildMaterializedScanCommandArgs(command, targetDir), "--json-out", reportPath];
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

  try {
    const reportJson = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(reportJson);
    const report: ReactDoctorScanReport = {
      version: parsed.version,
      summary: {
        errorCount: parsed.summary.errorCount,
        warningCount: parsed.summary.warningCount,
        affectedFileCount: parsed.summary.affectedFileCount,
      },
      diagnostics: parsed.diagnostics || [],
    };
    return report;
  } finally {
    try {
      rmSync(reportPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const writeMode = args.includes("--write");

  if (writeMode) {
    repin();
    return;
  }

  const status = reactDoctorFullScanTriageStatus;
  const pinnedSummary = loadPinnedFullScanSummary();

  const derivedPinnedWarningCount =
    status.untriagedWarningCountAtScan + status.classifiedFindingCount + status.classifiedWarningFamiliesCount;
  if (derivedPinnedWarningCount !== pinnedSummary.warningCount) {
    fail([
      `reactDoctorFullScanTriageStatus derives warningCount ${derivedPinnedWarningCount} but ` +
        `${reactDoctorPinPath} warningCount is ${pinnedSummary.warningCount}.`,
    ]);
  }
  if (status.errorCountAtScan !== pinnedSummary.errorCount) {
    fail([
      `reactDoctorFullScanTriageStatus.errorCountAtScan is ${status.errorCountAtScan} but ` +
        `${reactDoctorPinPath} errorCount is ${pinnedSummary.errorCount}.`,
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
