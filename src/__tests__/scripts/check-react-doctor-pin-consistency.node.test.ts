import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildMaterializedScanCommandArgs,
  buildOriginMainFetchArgs,
  buildScanComplexityIdentities,
  buildWarningRuleCounts,
  type ClassificationRecordRow,
  type ComplexityFindingIdentity,
  checkAncestry,
  checkPluginVersion,
  compareComplexityIdentitySets,
  complexityIdentityKey,
  extractComplexityFunctionName,
  extractPinnedFullScanSummary,
  findUnaccountedWarningRules,
  findWarningFamilyCountMismatches,
  parseCommandTokens,
  parseComplexityClassificationRecordRows,
  parseReactDoctorScanReport,
  type ReactDoctorScanDiagnostic,
  sumWarningFamilyCounts,
} from "../../../scripts/check-react-doctor-pin-consistency";
import { reactDoctorFullScanTriageStatus } from "../../../scripts/quality-baseline";

const complexityRule = "no-high-complexity-react-function";

function complexityDiagnostic(normalizedFilePath: string, functionName: string): ReactDoctorScanDiagnostic {
  return {
    rule: complexityRule,
    severity: "warning",
    normalizedFilePath,
    message: `\`${functionName}\` has cyclomatic complexity 20, cognitive complexity 20, and maximum nesting depth 1, so its React logic is hard to understand and change. Extract independent branches into components or hooks.`,
  };
}

function recordRow(
  normalizedFilePath: string,
  functionName: string,
  noLongerReported = false,
): ClassificationRecordRow {
  return {
    normalizedFilePath,
    functionName,
    classificationText: noLongerReported ? `accepted-risk (no longer reported: fixed in #999)` : "accepted-risk",
    noLongerReported,
  };
}

describe("check-react-doctor-pin-consistency", () => {
  describe("acceptance criterion: totals-only comparison hides a swapped finding", () => {
    // #300's draft failure, reproduced directly: the record and the scan both have 2 rows, so a
    // totals-only comparison reports no drift, while one finding on each side is not the other's.
    const recordRows: ClassificationRecordRow[] = [
      recordRow("src/components/a.tsx", "AliveBoth"),
      recordRow("src/components/only-in-record.tsx", "OnlyInRecord"),
    ];
    const scanIdentities: ComplexityFindingIdentity[] = [
      { rule: complexityRule, normalizedFilePath: "src/components/a.tsx", functionName: "AliveBoth" },
      { rule: complexityRule, normalizedFilePath: "src/components/only-in-scan.tsx", functionName: "OnlyInScan" },
    ];

    function totalsOnlyComparisonPasses(
      rows: readonly ClassificationRecordRow[],
      identities: readonly ComplexityFindingIdentity[],
    ): boolean {
      const activeRowCount = rows.filter((row) => !row.noLongerReported).length;
      return activeRowCount === identities.length;
    }

    it("demonstrates that a totals-only implementation would pass the swapped fixture (no detection power)", () => {
      expect(totalsOnlyComparisonPasses(recordRows, scanIdentities)).toBe(true);
    });

    it("fails the same fixture on the diagnostic identity set", () => {
      const comparison = compareComplexityIdentitySets(recordRows, scanIdentities, complexityRule);
      expect(comparison.recordOnly.map((identity) => identity.functionName)).toEqual(["OnlyInRecord"]);
      expect(comparison.scanOnly.map((identity) => identity.functionName)).toEqual(["OnlyInScan"]);
      expect(comparison.matchedCount).toBe(1);
    });
  });

  describe("compareComplexityIdentitySets", () => {
    it("agrees when the sets are identical", () => {
      const rows = [recordRow("src/a.tsx", "Fn1"), recordRow("src/b.tsx", "Fn2")];
      const identities = [
        { rule: complexityRule, normalizedFilePath: "src/a.tsx", functionName: "Fn1" },
        { rule: complexityRule, normalizedFilePath: "src/b.tsx", functionName: "Fn2" },
      ];
      const comparison = compareComplexityIdentitySets(rows, identities, complexityRule);
      expect(comparison.recordOnly).toEqual([]);
      expect(comparison.scanOnly).toEqual([]);
      expect(comparison.matchedCount).toBe(2);
    });

    it("excludes rows marked no longer reported from the record side", () => {
      const rows = [recordRow("src/a.tsx", "Fn1", true), recordRow("src/b.tsx", "Fn2")];
      const identities = [{ rule: complexityRule, normalizedFilePath: "src/b.tsx", functionName: "Fn2" }];
      const comparison = compareComplexityIdentitySets(rows, identities, complexityRule);
      expect(comparison.recordOnly).toEqual([]);
      expect(comparison.scanOnly).toEqual([]);
      expect(comparison.matchedCount).toBe(1);
    });

    it("does not use line numbers as part of the identity", () => {
      // Real drift measured at the current pin: article-list-item.tsx record row is at line 25,
      // the scan currently reports it at line 24. Identity must match by rule+path+function only.
      const rows = [recordRow("src/components/reader/article-list-item.tsx", "ArticleListItem")];
      const identities = [
        {
          rule: complexityRule,
          normalizedFilePath: "src/components/reader/article-list-item.tsx",
          functionName: "ArticleListItem",
        },
      ];
      const comparison = compareComplexityIdentitySets(rows, identities, complexityRule);
      expect(comparison.recordOnly).toEqual([]);
      expect(comparison.scanOnly).toEqual([]);
    });
  });

  describe("complexityIdentityKey / extractComplexityFunctionName", () => {
    it("builds a stable key from rule, path and function name", () => {
      expect(complexityIdentityKey({ rule: "r", normalizedFilePath: "p.tsx", functionName: "Fn" })).toBe(
        "r::p.tsx::Fn",
      );
    });

    it("extracts the backticked function name prefix from the rule message", () => {
      expect(
        extractComplexityFunctionName(
          "`ArticleListItem` has cyclomatic complexity 29, cognitive complexity 28, and maximum nesting depth 1, so its React logic is hard to understand and change. Extract independent branches into components or hooks.",
        ),
      ).toBe("ArticleListItem");
    });

    it("returns null when the message does not start with a backticked name", () => {
      expect(extractComplexityFunctionName("no backtick here")).toBeNull();
    });
  });

  describe("buildScanComplexityIdentities", () => {
    it("keeps only diagnostics for the classified rule and derives the function name", () => {
      const diagnostics: ReactDoctorScanDiagnostic[] = [
        complexityDiagnostic("src/a.tsx", "Fn1"),
        { rule: "no-self-updating-effect", severity: "warning", normalizedFilePath: "src/b.tsx", message: "unrelated" },
      ];
      const identities = buildScanComplexityIdentities(diagnostics, complexityRule);
      expect(identities).toEqual([{ rule: complexityRule, normalizedFilePath: "src/a.tsx", functionName: "Fn1" }]);
    });

    it("throws if a complexity diagnostic has no extractable function name", () => {
      const diagnostics: ReactDoctorScanDiagnostic[] = [
        {
          rule: complexityRule,
          severity: "warning",
          normalizedFilePath: "src/a.tsx",
          message: "no backtick name here",
        },
      ];
      expect(() => buildScanComplexityIdentities(diagnostics, complexityRule)).toThrow();
    });
  });

  describe("parseComplexityClassificationRecordRows", () => {
    it("parses a data row and detects the no-longer-reported marker", () => {
      const markdown = [
        "| Location | Function | cy | co | F | Classification | Rationale |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        "| `src/components/app-layout.tsx:297` | `WideLayout` | 18 | 16 | A | accepted-risk | Some rationale. |",
        "| `src/components/reader/sidebar-nav-button.tsx:39` | `SidebarNavButton` | 15 | 16 | B | accepted-risk (no longer reported: fixed in #306) | Rationale text. |",
      ].join("\n");
      const rows = parseComplexityClassificationRecordRows(markdown);
      expect(rows).toEqual([
        {
          normalizedFilePath: "src/components/app-layout.tsx",
          functionName: "WideLayout",
          classificationText: "accepted-risk",
          noLongerReported: false,
        },
        {
          normalizedFilePath: "src/components/reader/sidebar-nav-button.tsx",
          functionName: "SidebarNavButton",
          classificationText: "accepted-risk (no longer reported: fixed in #306)",
          noLongerReported: true,
        },
      ]);
    });

    it("does not split on an escaped pipe inside the rationale column", () => {
      const markdown =
        "| `src/components/a.tsx:10` | `Fn` | 16 | 16 | A | accepted-risk | uses `visible \\|\\| holding` as a guard |";
      const rows = parseComplexityClassificationRecordRows(markdown);
      expect(rows).toHaveLength(1);
      expect(rows[0].functionName).toBe("Fn");
      expect(rows[0].classificationText).toBe("accepted-risk");
    });

    it("ignores header and separator rows", () => {
      const markdown = [
        "| Location | Function | cy | co | F | Classification | Rationale |",
        "| --- | --- | --- | --- | --- | --- | --- |",
      ].join("\n");
      expect(parseComplexityClassificationRecordRows(markdown)).toEqual([]);
    });

    it("parses every row of the real classification record with the pinned counts", () => {
      const markdown = readFileSync(reactDoctorFullScanTriageStatus.classifiedRecordPath, "utf8");
      const rows = parseComplexityClassificationRecordRows(markdown);
      const activeRows = rows.filter((row) => !row.noLongerReported);
      expect(activeRows).toHaveLength(reactDoctorFullScanTriageStatus.classifiedFindingCount);
    });
  });

  describe("sumWarningFamilyCounts / findWarningFamilyCountMismatches", () => {
    it("sums duplicate rule entries before comparing", () => {
      const totals = sumWarningFamilyCounts([
        { rule: "no-adjust-state-on-prop-change", count: 0 },
        { rule: "no-adjust-state-on-prop-change", count: 1 },
      ]);
      expect(totals.get("no-adjust-state-on-prop-change")).toBe(1);
    });

    it("reports a mismatch when the scan disagrees with the pinned family count", () => {
      const totals = sumWarningFamilyCounts([{ rule: "no-self-updating-effect", count: 1 }]);
      const scanCounts = new Map([["no-self-updating-effect", 2]]);
      expect(findWarningFamilyCountMismatches(totals, scanCounts)).toEqual([
        { rule: "no-self-updating-effect", expected: 1, actual: 2 },
      ]);
    });

    it("treats an absent rule in the scan as a count of zero", () => {
      const totals = sumWarningFamilyCounts([{ rule: "prefer-html-dialog", count: 0 }]);
      expect(findWarningFamilyCountMismatches(totals, new Map())).toEqual([]);
    });
  });

  describe("buildWarningRuleCounts / findUnaccountedWarningRules", () => {
    it("counts only warning-severity diagnostics per rule", () => {
      const diagnostics: ReactDoctorScanDiagnostic[] = [
        { rule: "rule-a", severity: "warning", normalizedFilePath: "f.tsx", message: "" },
        { rule: "rule-a", severity: "warning", normalizedFilePath: "g.tsx", message: "" },
        { rule: "rule-b", severity: "error", normalizedFilePath: "h.tsx", message: "" },
      ];
      const counts = buildWarningRuleCounts(diagnostics);
      expect(counts.get("rule-a")).toBe(2);
      expect(counts.has("rule-b")).toBe(false);
    });

    it("flags a rule with no classification", () => {
      const counts = new Map([
        ["known-rule", 1],
        ["mystery-rule", 3],
      ]);
      expect(findUnaccountedWarningRules(counts, new Set(["known-rule"]))).toEqual(["mystery-rule"]);
    });

    it("accepts a rule that is accounted for", () => {
      const counts = new Map([["known-rule", 1]]);
      expect(findUnaccountedWarningRules(counts, new Set(["known-rule"]))).toEqual([]);
    });
  });

  describe("extractPinnedFullScanSummary", () => {
    it("extracts the pinned full-scan totals from the quality-baseline source", () => {
      const source = [
        "const reactDoctorBaselines = {",
        "  diff: {",
        "    score: null,",
        "    errorCount: 0,",
        "    warningCount: 0,",
        "    affectedFileCount: 0,",
        "  },",
        "  full: {",
        "    score: null,",
        "    errorCount: 2,",
        "    warningCount: 32,",
        "    affectedFileCount: 32,",
        "  },",
        "} as const;",
      ].join("\n");
      expect(extractPinnedFullScanSummary(source)).toEqual({ errorCount: 2, warningCount: 32, affectedFileCount: 32 });
    });

    it("throws when the pinned block cannot be found", () => {
      expect(() => extractPinnedFullScanSummary("no such block here")).toThrow();
    });

    it("matches the real reactDoctorFullScanTriageStatus derivation against the current source", () => {
      const source = readFileSync("scripts/quality-baseline.ts", "utf8");
      const pinned = extractPinnedFullScanSummary(source);
      const status = reactDoctorFullScanTriageStatus;
      expect(pinned.errorCount).toBe(status.errorCountAtScan);
      expect(pinned.warningCount).toBe(
        status.untriagedWarningCountAtScan + status.classifiedFindingCount + status.classifiedWarningFamiliesCount,
      );
    });
  });

  describe("buildOriginMainFetchArgs", () => {
    // A depth-1 CI checkout that already has refs/remotes/origin/main fetches nothing without
    // --unshallow, so scanSha stays outside the boundary and rev-parse fails. A complete clone
    // rejects --unshallow outright. Both measured; neither shape can be covered by running the
    // real fetch here.
    it("deepens a shallow clone so scanSha is reachable", () => {
      expect(buildOriginMainFetchArgs(true)).toEqual([
        "fetch",
        "--no-prune",
        "--force",
        "--unshallow",
        "origin",
        "main:refs/remotes/origin/main",
      ]);
    });

    it("omits --unshallow on a complete clone, which git rejects", () => {
      expect(buildOriginMainFetchArgs(false)).toEqual([
        "fetch",
        "--no-prune",
        "--force",
        "origin",
        "main:refs/remotes/origin/main",
      ]);
    });

    it("always disables prune, which would otherwise delete the ref it just fetched", () => {
      for (const isShallow of [true, false]) {
        expect(buildOriginMainFetchArgs(isShallow)).toContain("--no-prune");
      }
    });
  });

  describe("parseCommandTokens / buildMaterializedScanCommandArgs", () => {
    it("splits the pinned command into tokens", () => {
      expect(parseCommandTokens("react-doctor . --scope full")).toEqual(["react-doctor", ".", "--scope", "full"]);
    });

    it("replaces every standalone . token with the target directory", () => {
      expect(buildMaterializedScanCommandArgs("react-doctor . --project . --scope full", "/tmp/scan-tree")).toEqual([
        "react-doctor",
        "/tmp/scan-tree",
        "--project",
        "/tmp/scan-tree",
        "--scope",
        "full",
      ]);
    });

    it("matches the pinned scanCommand and auditScanCommand shape", () => {
      const status = reactDoctorFullScanTriageStatus;
      expect(buildMaterializedScanCommandArgs(status.scanCommand, "/tmp/x")).toEqual([
        "react-doctor",
        "/tmp/x",
        "--verbose",
        "--project",
        "/tmp/x",
        "--scope",
        "full",
        "--json",
        "--json-compact",
        "--blocking",
        "none",
        "--no-score",
        "--no-dead-code",
      ]);
      expect(buildMaterializedScanCommandArgs(status.auditScanCommand, "/tmp/x")).toEqual([
        ...buildMaterializedScanCommandArgs(status.scanCommand, "/tmp/x"),
        "--no-respect-inline-disables",
      ]);
    });
  });

  describe("parseReactDoctorScanReport", () => {
    it("parses version, summary and diagnostics from JSON", () => {
      const stdout = JSON.stringify({
        version: "0.9.14",
        summary: { errorCount: 1, warningCount: 2, affectedFileCount: 3 },
        diagnostics: [{ rule: "rule-a", severity: "warning", normalizedFilePath: "a.tsx", message: "msg" }],
      });
      const report = parseReactDoctorScanReport(stdout);
      expect(report.version).toBe("0.9.14");
      expect(report.summary).toEqual({ errorCount: 1, warningCount: 2, affectedFileCount: 3 });
      expect(report.diagnostics).toEqual([
        { rule: "rule-a", severity: "warning", normalizedFilePath: "a.tsx", message: "msg" },
      ]);
    });

    it("reads the report when react-doctor prints log lines before it", () => {
      const report = {
        version: "0.9.14",
        summary: { errorCount: 0, warningCount: 1, affectedFileCount: 1 },
        diagnostics: [{ rule: "rule-a", severity: "warning", normalizedFilePath: "a.tsx", message: "msg" }],
      };
      const stdout = `oxlint-plugin-react-doctor 0.9.14\n{"level":"info","msg":"scanning"}\n${JSON.stringify(report)}`;

      expect(parseReactDoctorScanReport(stdout).summary.warningCount).toBe(1);
    });

    it("throws on a report missing summary", () => {
      expect(() => parseReactDoctorScanReport(JSON.stringify({ version: "0.9.14", diagnostics: [] }))).toThrow();
    });

    it("throws on a report missing diagnostics", () => {
      expect(() =>
        parseReactDoctorScanReport(
          JSON.stringify({ version: "0.9.14", summary: { errorCount: 0, warningCount: 0, affectedFileCount: 0 } }),
        ),
      ).toThrow();
    });
  });

  describe("checkAncestry", () => {
    it("passes when the resolved commit is an ancestor of origin/main", () => {
      expect(checkAncestry("742a6919b", "742a6919babc", true)).toBeNull();
    });

    it("fails when the resolved commit is not an ancestor of origin/main", () => {
      expect(checkAncestry("742a6919b", "742a6919babc", false)).toBe(
        "scanSha 742a6919b (742a6919babc) is not an ancestor of origin/main.",
      );
    });
  });

  describe("checkPluginVersion", () => {
    it("passes when the scanned version matches the pinned pluginVersion", () => {
      const status = reactDoctorFullScanTriageStatus;
      expect(checkPluginVersion(status.pluginVersion, status.pluginVersion)).toBeNull();
    });

    it("fails when the scanned version differs from the pinned pluginVersion", () => {
      const status = reactDoctorFullScanTriageStatus;
      expect(checkPluginVersion("0.9.13", status.pluginVersion)).toBe(
        `plugin version drift: scan reports 0.9.13, pinned pluginVersion is ${status.pluginVersion}.`,
      );
    });
  });

  describe("unaccounted-rule failure fixture", () => {
    it("fails when the scan reports a rule with no complexity/family/pending classification", () => {
      const counts = buildWarningRuleCounts([
        { rule: "no-self-updating-effect", severity: "warning", normalizedFilePath: "a.tsx", message: "" },
        { rule: "brand-new-unclassified-rule", severity: "warning", normalizedFilePath: "b.tsx", message: "" },
      ]);
      const accounted = new Set(["no-self-updating-effect", complexityRule]);
      expect(findUnaccountedWarningRules(counts, accounted)).toEqual(["brand-new-unclassified-rule"]);
    });
  });

  describe("pendingJudgmentWarningFamilies count drift", () => {
    it("catches a pending-family rule reporting more findings than its pinned count", () => {
      // A pending rule adding accountedRuleNames coverage without a count check would let this
      // pass silently, which is the gap a real pendingJudgmentWarningFamilies entry would expose.
      const pendingTotals = sumWarningFamilyCounts([{ rule: "some-pending-rule", count: 1 }]);
      const scanCounts = buildWarningRuleCounts([
        { rule: "some-pending-rule", severity: "warning", normalizedFilePath: "a.tsx", message: "" },
        { rule: "some-pending-rule", severity: "warning", normalizedFilePath: "b.tsx", message: "" },
      ]);
      expect(findWarningFamilyCountMismatches(pendingTotals, scanCounts)).toEqual([
        { rule: "some-pending-rule", expected: 1, actual: 2 },
      ]);
    });
  });

  describe("real-data path", () => {
    it("the current classification record agrees exactly with the pinned classifiedFindingCount", () => {
      const status = reactDoctorFullScanTriageStatus;
      const markdown = readFileSync(status.classifiedRecordPath, "utf8");
      const rows = parseComplexityClassificationRecordRows(markdown);
      const activeRows = rows.filter((row) => !row.noLongerReported);
      expect(activeRows).toHaveLength(status.classifiedFindingCount);

      const activeKeys = new Set(
        activeRows.map((row) =>
          complexityIdentityKey({
            rule: status.classifiedRule,
            normalizedFilePath: row.normalizedFilePath,
            functionName: row.functionName,
          }),
        ),
      );
      expect(activeKeys.size).toBe(activeRows.length);
    });
  });
});
