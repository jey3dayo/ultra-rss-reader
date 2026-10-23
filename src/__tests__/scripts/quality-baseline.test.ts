import type { SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReactDoctorRuleCounts,
  createProcessDiagnostic,
  createReportDiagnostic,
  formatKnipIssue,
  isExpectedReactDoctorReportMode,
  isQualityBaselineRepoScanIgnoredPath,
  parseKnipReport,
  partitionQualityBaselineRepoScanPaths,
  qualityBaselineRepoScanIgnoredPathPrefixes,
  reactDoctorDegradedNotice,
  reactDoctorFullScanTriageStatus,
  reactDoctorScopeArgs,
  readReactDoctorJsonOutReport,
} from "../../../scripts/quality-baseline.ts";

describe("quality-baseline", () => {
  // The diff gate's whole contract lives in these flags. `changed` is what makes an
  // already-accepted finding in a touched file stop failing the gate, and `--include-untracked`
  // is what keeps a brand-new file from passing unscanned; losing either is silent.
  it("scans only findings new against origin/main, including untracked files, in diff mode", () => {
    expect(reactDoctorScopeArgs("diff")).toEqual([
      "--scope",
      "changed",
      "--base",
      "origin/main",
      "--include-untracked",
    ]);
  });

  it("scans the whole project in full mode", () => {
    expect(reactDoctorScopeArgs("full")).toEqual(["--scope", "full"]);
  });

  // Under `--scope changed` react-doctor reports `baseline` as soon as it has findings to
  // compare and `diff` when it has none, so pinning the literal "diff" only passed while the
  // scan was empty and broke on the first branch that actually had a finding.
  it("accepts either mode react-doctor reports for a changed-scope scan", () => {
    expect(isExpectedReactDoctorReportMode("diff", "diff")).toBe(true);
    expect(isExpectedReactDoctorReportMode("diff", "baseline")).toBe(true);
  });

  it("rejects a full scan reported for the diff gate and the reverse", () => {
    expect(isExpectedReactDoctorReportMode("diff", "full")).toBe(false);
    expect(isExpectedReactDoctorReportMode("full", "baseline")).toBe(false);
    expect(isExpectedReactDoctorReportMode("full", "full")).toBe(true);
  });

  it("formats Knip issues with safe category and symbol summaries", () => {
    expect(
      formatKnipIssue({
        file: "src/example.ts",
        files: [{ name: "example.ts" }],
        exports: [{ name: "useThing" }, { name: "useOtherThing" }],
        duplicates: [[{ name: "one" }, { name: "two" }]],
        futureShape: { ignored: true },
      }),
    ).toBe("src/example.ts files: example.ts exports: useThing, useOtherThing duplicates");
    expect(formatKnipIssue({ file: "src/empty.ts", binaries: [null] })).toBe("src/empty.ts binaries");
    // An unused file reports its own path as the entry name; keep the line to one copy.
    expect(formatKnipIssue({ file: "src/unused.ts", files: [{ name: "src/unused.ts" }] })).toBe("src/unused.ts files");
    expect(formatKnipIssue({ file: 42, exports: "not-an-array" })).toBe("<unknown file>");
  });

  // The notice is the only thing that distinguishes a delta result from a changed-files
  // result, since the counts are identical in shape. Pin both directions so removing the
  // branch cannot pass as working.
  it("says so when the run had no baseline comparison, and stays quiet when it did", () => {
    expect(reactDoctorDegradedNotice({ baselineDegraded: true })).toContain("no baseline comparison");
    expect(reactDoctorDegradedNotice({ baselineDegraded: true })).toContain("every finding in the changed files");
    expect(reactDoctorDegradedNotice({ baselineDegraded: false })).toBeNull();
  });

  it("keeps nested braces and braces inside strings inside the JSON payload", () => {
    // parseKnipReport reads the last non-empty line
    const output = [
      "knip 6.18.0",
      '{"issues":[{"file":"src/example.ts","exports":["useThing"],"note":"literal { brace }"}]}',
    ].join("\n");

    expect(parseKnipReport(output)).toEqual({
      issues: [
        {
          file: "src/example.ts",
          exports: ["useThing"],
          note: "literal { brace }",
        },
      ],
    });
  });

  it("keeps diagnostics with no readable rule or severity in the breakdown", () => {
    const report = {
      version: "0.9.13",
      mode: "full",
      baselineDegraded: false,
      summary: { score: null, errorCount: 0, warningCount: 2, affectedFileCount: 1 },
      diagnostics: [
        { severity: "warning", rule: "(unknown rule)" },
        { severity: "(unknown severity)", rule: "(unknown rule)" },
      ],
    };

    expect(buildReactDoctorRuleCounts(report.diagnostics)).toEqual([
      { severity: "warning", rule: "(unknown rule)", count: 1 },
      { severity: "(unknown severity)", rule: "(unknown rule)", count: 1 },
    ]);
  });

  it("keeps the full-scan triage status honest about what the snapshot covers", () => {
    const status = reactDoctorFullScanTriageStatus;

    // The snapshot totals are not a classification set: the notice has to name a tracker
    // for the warnings and errors the pass did not classify, so a zero baseline delta
    // never reads as approval.
    expect(status.untriagedWarningIssue).toContain("/issues/256");
    expect(status.errorIssue).toContain("/issues/260");
    expect(status.outlierIssue).toContain("/issues/256");
    expect(status.reportArtifactPath).toBe("tmp/react-doctor-full.json");

    // What keeps the report honest is auditWarningCount: 0 untriaged means every finding has a
    // recorded verdict, not that the code has none, and most of those verdicts are inline
    // disables. A pin where the two totals agree would be claiming there is nothing suppressed.
    // reactDoctorBaselines stays unexported on purpose (see the note further down), so the
    // scanned warningCount is reconstructed from the status rather than imported.
    const scannedWarningCount =
      status.untriagedWarningCountAtScan + status.classifiedFindingCount + status.classifiedWarningFamiliesCount;
    expect(status.auditWarningCount).toBeGreaterThan(scannedWarningCount);
    expect(status.auditScanCommand).toContain("--no-respect-inline-disables");

    // An earlier pass already classified one error finding. Re-pinning a total must not
    // erase that, so the record has to survive in the status the wrapper prints.
    expect(status.previouslyClassifiedErrors).toEqual([
      expect.objectContaining({ rule: "no-prop-callback-in-render", classification: "accepted-risk" }),
    ]);
  });

  it("accounts for every scanned error in the classification dispositions", () => {
    const status = reactDoctorFullScanTriageStatus;
    const { mustFix, falsePositive, acceptedRisk } = status.errorClassification;

    // The wrapper prints "all classified", so the dispositions must add up to the scanned
    // error count. Re-pinning errorCountAtScan without re-classifying fails here instead of
    // letting the report claim coverage the record does not have.
    expect(mustFix + falsePositive + acceptedRisk).toBe(status.errorCountAtScan);
    expect(status.errorClassification.recordPath).toBe("docs/react-doctor-error-triage.md");

    // The one error classified before this pass is a subset of it, not a separate finding.
    expect(status.previouslyClassifiedErrors.length).toBeLessThanOrEqual(acceptedRisk);
  });

  it("derives the untriaged warning count from the classified families instead of a hand-pinned number", () => {
    const status = reactDoctorFullScanTriageStatus;

    // Pins the family total so an added/removed rule is caught here, not as a silent drift
    // below. Retired or inactive rules keep a count-0 row as the record of that decision.
    expect(status.classifiedWarningFamiliesCount).toBe(7);
    expect(status.classifiedFindingCount).toBe(22);

    // Do not re-declare the scanned warningCount here: reactDoctorBaselines is not exported
    // (adding an export just for this identity would grow the Knip-tracked export surface, see
    // .claude/rules/quality-policy.md), and copying the literal in would be the same
    // hand-pinned-number drift risk this status was built to remove. Pinning the derived total
    // below is what actually catches a broken subtraction: if untriagedWarningCountAtScan stops
    // being warningCount minus the two classified totals, this assertion fails without needing
    // a second copy of warningCount in this file.
    //
    // This assertion only confirms the arithmetic still holds, which is not the same as the
    // sets agreeing. scripts/check-react-doctor-pin-consistency.ts is the set comparison, and
    // it also covers scanSha ancestry and reproducing the totals at that tree, which nothing
    // in this file does.
    expect(status.untriagedWarningCountAtScan).toBe(0);
  });

  it("keeps rerender-lazy-ref-init out of the classified warning families table", () => {
    const status = reactDoctorFullScanTriageStatus;

    // rerender-lazy-ref-init must not be absorbed into a "classified" family: a fixed finding
    // has no disposition that would apply again if the rule fired. Empty because every
    // currently-reported finding already has its own record row.
    // The families table's rule field is a narrow string-literal union by design, so widen
    // to `readonly string[]` via the annotation below rather than asserting past the type.
    const classifiedFamilyRules: readonly string[] = status.classifiedWarningFamilies.map((family) => family.rule);
    expect(classifiedFamilyRules.includes("rerender-lazy-ref-init")).toBe(false);
    // Empty because the complexity outlier has its own classified row rather than being a
    // pending judgment. The assertion stays so that folding a future pending finding into the
    // classified table without a record row still fails here.
    expect(status.pendingJudgmentWarningFamilies).toEqual([]);
  });

  it("reads the Knip report after unrelated JSON objects", () => {
    const output = '{"event":"start"}\n{"issues":[]}';

    expect(parseKnipReport(output)).toEqual({ issues: [] });
  });

  it("rejects JSON array output as a malformed tool report", () => {
    expect(() => parseKnipReport('[{"file":"src/example.ts"}]')).toThrow(
      "Knip did not return a valid report JSON object:",
    );
  });

  it("reports a missing command from the process error code", () => {
    const error = Object.assign(new Error("spawn pnpm ENOENT"), {
      code: "ENOENT",
    });

    expect(
      createProcessDiagnostic("React Doctor", "pnpm exec react-doctor", spawnResult({ error, status: null })),
    ).toMatchObject({
      kind: "missing-command",
      tool: "React Doctor",
      command: "pnpm exec react-doctor",
    });
  });

  it("reports non-zero exits with status and stderr", () => {
    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ status: 2, stderr: "failed to load config" }),
      ),
    ).toMatchObject({
      kind: "non-zero-exit",
      exitCode: 2,
      stderr: "failed to load config",
    });
  });

  it("reports empty tool reports separately from malformed reports", () => {
    expect(createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "", new Error("no json"))).toMatchObject({
      kind: "empty-report",
      stdout: undefined,
    });

    expect(
      createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "react-doctor 0.5.8\n{not json}", new Error()),
    ).toMatchObject({
      kind: "malformed-report",
      stdout: "react-doctor 0.5.8\n{not json}",
    });
  });

  it("reports malformed version probes with the probed command and captured stdout", () => {
    expect(
      createReportDiagnostic("Knip", "pnpm exec knip --version", "knip dev build", "Could not read Knip version."),
    ).toEqual({
      kind: "malformed-report",
      tool: "Knip",
      command: "pnpm exec knip --version",
      message: "Knip returned output, but no valid report JSON could be parsed.",
      stdout: "knip dev build",
      stderr: undefined,
    });
  });

  it("reports timeouts from the process error code", () => {
    const error = Object.assign(new Error("spawnSync pnpm ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });

    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ error, signal: "SIGTERM", status: null }),
      ),
    ).toMatchObject({
      kind: "timeout",
      signal: "SIGTERM",
    });
  });

  it("reports unexpected process errors before report parsing", () => {
    const error = Object.assign(new Error("spawnSync pnpm EACCES"), {
      code: "EACCES",
    });

    expect(createProcessDiagnostic("Knip", "pnpm exec knip", spawnResult({ error, status: null }))).toMatchObject({
      kind: "process-error",
      stderr: "spawnSync pnpm EACCES",
    });
  });

  it("reports signal termination while preserving captured output", () => {
    expect(
      createProcessDiagnostic(
        "Knip",
        "pnpm exec knip",
        spawnResult({
          signal: "SIGKILL",
          status: null,
          stdout: "partial json",
          stderr: "killed",
        }),
      ),
    ).toMatchObject({
      kind: "signal",
      signal: "SIGKILL",
      stdout: "partial json",
      stderr: "killed",
    });
  });

  it("keeps generated schemas and target artifacts out of quality repo scans", () => {
    expect(qualityBaselineRepoScanIgnoredPathPrefixes).toEqual(
      expect.arrayContaining(["src-tauri/target/", "src-tauri/gen/schemas/"]),
    );

    expect(isQualityBaselineRepoScanIgnoredPath("src-tauri/target/debug/build.rs")).toBe(true);
    expect(isQualityBaselineRepoScanIgnoredPath(".\\src-tauri\\gen\\schemas\\desktop-schema.json")).toBe(true);
    expect(isQualityBaselineRepoScanIgnoredPath("src-tauri/capabilities/default.json")).toBe(false);
    expect(isQualityBaselineRepoScanIgnoredPath("src/api/schemas.ts")).toBe(false);
  });

  it("partitions quality repo scan paths without hiding source-owned schemas", () => {
    expect(
      partitionQualityBaselineRepoScanPaths([
        "src/api/schemas.ts",
        "src-tauri/gen/schemas/capabilities.json",
        "src-tauri/capabilities/default.json",
        "src-tauri/target/debug/app",
      ]),
    ).toEqual({
      includedPaths: ["src/api/schemas.ts", "src-tauri/capabilities/default.json"],
      ignoredPaths: ["src-tauri/gen/schemas/capabilities.json", "src-tauri/target/debug/app"],
    });
  });

  describe("readReactDoctorJsonOutReport", () => {
    it("throws when the report file does not exist", () => {
      expect(() => readReactDoctorJsonOutReport("/nonexistent/report.json")).toThrow();
    });

    it("throws when the report file contains invalid JSON", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "react-doctor-test-"));
      const reportPath = join(tmpDir, "invalid.json");
      try {
        writeFileSync(reportPath, "{not valid json}", "utf8");
        expect(() => readReactDoctorJsonOutReport(reportPath)).toThrow();
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("throws when the report file has a schema mismatch", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "react-doctor-test-"));
      const reportPath = join(tmpDir, "mismatch.json");
      try {
        // Valid JSON but missing required fields
        writeFileSync(reportPath, JSON.stringify({ version: "0.9.18" }), "utf8");
        expect(() => readReactDoctorJsonOutReport(reportPath)).toThrow(/Invalid react-doctor report/);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("reads a valid report file and returns parsed diagnostics", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "react-doctor-test-"));
      const reportPath = join(tmpDir, "valid.json");
      try {
        const validReport = {
          version: "0.9.18",
          mode: "full",
          summary: {
            score: null,
            errorCount: 1,
            warningCount: 2,
            affectedFileCount: 2,
          },
          diagnostics: [
            { severity: "error", rule: "no-ref-current-in-render" },
            { severity: "warning", rule: "exhaustive-deps" },
            { severity: "warning", rule: "no-high-complexity-react-function" },
          ],
        };
        writeFileSync(reportPath, JSON.stringify(validReport), "utf8");

        const result = readReactDoctorJsonOutReport(reportPath);

        expect(result.version).toBe("0.9.18");
        expect(result.mode).toBe("full");
        expect(result.summary.errorCount).toBe(1);
        expect(result.summary.warningCount).toBe(2);
        expect(result.diagnostics).toHaveLength(3);
        expect(result.diagnostics[0]).toMatchObject({ severity: "error", rule: "no-ref-current-in-render" });
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});

function spawnResult(overrides: Partial<SpawnSyncReturns<string>> = {}): SpawnSyncReturns<string> {
  return {
    pid: 123,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    ...overrides,
  };
}
