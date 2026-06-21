import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSimilarityCommandArgs,
  buildSimilaritySummary,
  defaultPath,
  defaultThreshold,
  evaluateSimilarityReportGate,
  findFalsePositiveMatch,
  isSimilarityReportEntrypoint,
  parseSimilarityOutput,
  parseSimilarityPairs,
  readThreshold,
  similarityFalsePositiveBaseline,
  similarityScanExcludePatterns,
  similarityThresholds,
  similarityUsage,
} from "../../../scripts/similarity-report";

const sampleReport = `
Similarity: 92.07%, Score: 56.6 points (lines 61~62, avg: 61.5)
  src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts:65-125 useBrowserWebviewBoundsSync
  src/hooks/use-updater.ts:267-328 useUpdater

Similarity: 90.39%, Score: 33.9 points (lines 14~61, avg: 37.5)
  src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts:65-125 useBrowserWebviewBoundsSync
  src/components/settings/account-detail/query-cache.ts:10-23 patchCachedAccount
`;

describe("similarity-report", () => {
  it("parses function pairs from similarity-ts output", () => {
    expect(parseSimilarityPairs(sampleReport)).toEqual([
      {
        similarityPercent: 92.07,
        score: 56.6,
        averageLines: 61.5,
        firstPath: "src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts",
        firstSymbol: "useBrowserWebviewBoundsSync",
        secondPath: "src/hooks/use-updater.ts",
        secondSymbol: "useUpdater",
      },
      {
        similarityPercent: 90.39,
        score: 33.9,
        averageLines: 37.5,
        firstPath: "src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts",
        firstSymbol: "useBrowserWebviewBoundsSync",
        secondPath: "src/components/settings/account-detail/query-cache.ts",
        secondSymbol: "patchCachedAccount",
      },
    ]);
  });

  it("parses Windows paths and symbols containing colons from similarity-ts output", () => {
    const report = `
Similarity: 95.01%, Score: 42.5 points (lines 20~30, avg: 25.0)
  C:\\work\\ultra-rss-reader\\src\\alpha.ts:20-44 namespace:useAlpha
  C:\\work\\ultra-rss-reader\\src\\beta.ts:30-54 namespace:useBeta
`;

    expect(parseSimilarityPairs(report)).toEqual([
      {
        similarityPercent: 95.01,
        score: 42.5,
        averageLines: 25,
        firstPath: "C:\\work\\ultra-rss-reader\\src\\alpha.ts",
        firstSymbol: "namespace:useAlpha",
        secondPath: "C:\\work\\ultra-rss-reader\\src\\beta.ts",
        secondSymbol: "namespace:useBeta",
      },
    ]);
  });

  it("parses space paths, missing symbols, and CRLF output from similarity-ts output", () => {
    const report = [
      "Similarity: 90.00%, Score: 12.3 points (lines 4~6, avg: 5.0)",
      "  /tmp/work tree/src/alpha.ts:4-8",
      "  /tmp/work tree/src/beta.ts:9-13 useBeta",
      "",
    ].join("\r\n");

    expect(parseSimilarityPairs(report)).toEqual([
      {
        similarityPercent: 90,
        score: 12.3,
        averageLines: 5,
        firstPath: "/tmp/work tree/src/alpha.ts",
        firstSymbol: "",
        secondPath: "/tmp/work tree/src/beta.ts",
        secondSymbol: "useBeta",
      },
    ]);
  });

  it("classifies account cache updater and hook lifecycle pairs as false positives", () => {
    const pairs = parseSimilarityPairs(sampleReport);

    expect(pairs.map(findFalsePositiveMatch).map((item) => item?.classification)).toEqual([
      "hook-lifecycle-baseline",
      "cache-helper-vs-hook-lifecycle",
    ]);
  });

  it("reports absent allowlist entries against scan baselines", () => {
    const summary = buildSimilaritySummary(sampleReport);

    expect(summary).toContain("thresholds: 0.95 / 0.9 / 0.87");
    expect(summary).toContain("scan excludes: node_modules / dist / src-tauri/target");
    expect(summary).toContain("unparsed similarity blocks: 0");
    expect(summary).toContain("scan baseline function pairs: 42");
    expect(summary).toContain("allowlisted false positives present: 2");
    expect(summary).toContain("allowlisted false positives absent: 11");
    expect(summary).not.toContain("TODO baseline");
    expect(summary).toContain("absent article-auto-mark-vs-browser-webview-sync");
  });

  it("ignores type similarity blocks when parsing function pairs", () => {
    const report = `
=== Function Similarity ===
${sampleReport}
=== Type Similarity ===

Similarity: 95.47% (structural: 100.00%, naming: 88.67%)
  src/components/settings/shared/settings-shell-section-label.tsx:4 | L4-7 similar-type: SettingsShellSectionLabelProps (type)
  src/components/shared/section-heading.tsx:4 | L4-7 similar-type: SectionHeadingProps (type)

Similarity: 100.00% (structural: 100.00%, naming: 100.00%)
  src/__tests__/components/use-article-list-data.node.test.ts:11 | L11 type-literal: buildSourcePlan (parameter: params)
  src/__tests__/components/use-article-list-data.node.test.tsx:15 | L15 type-literal: buildSourcePlan (parameter: params)
`;

    expect(parseSimilarityOutput(report)).toEqual({
      pairs: parseSimilarityPairs(sampleReport),
      skippedSimilarityBlocks: 0,
    });
    expect(buildSimilaritySummary(report)).toContain("unparsed similarity blocks: 0");
  });

  it("reports unparsed similarity blocks so similarity-ts output drift is visible", () => {
    const driftedReport = `
Similarity: 91.00%, Score: 12.0 points (lines 4~6)
  src/alpha.ts:4-8 useAlpha
  src/beta.ts:9-13 useBeta

Similarity: 90.00%, Score: 12.3 points (lines 4~6, avg: 5.0)
  src/alpha.ts:4-8 useAlpha
`;

    expect(parseSimilarityOutput(driftedReport)).toEqual({
      pairs: [],
      skippedSimilarityBlocks: 2,
    });
    expect(buildSimilaritySummary(driftedReport)).toContain("unparsed similarity blocks: 2");
    expect(evaluateSimilarityReportGate(driftedReport)).toEqual({
      exitCode: 1,
      message: "Similarity report gate failed: unparsed similarity blocks: 2",
    });
  });

  it("reports type-pair count drift from similarity-ts output", () => {
    const report = [
      "Total similar type pairs found: 3",
      "  src/types/a.ts:1-2 A (type)",
      "  src/types/b.ts:3-4 B (type)",
    ].join("\n");

    expect(buildSimilaritySummary(report)).toContain("type pair report drift: 2");
    expect(evaluateSimilarityReportGate(report)).toEqual({
      exitCode: 1,
      message: "Similarity report gate failed: type pair report drift: 2",
    });
  });

  it("keeps the report gate green when similarity-ts output matches the parser contract", () => {
    expect(evaluateSimilarityReportGate(sampleReport)).toBeNull();
  });

  it("keeps false-positive allowlist reporting independent from TODO content", () => {
    const summary = buildSimilaritySummary(sampleReport);

    expect(summary).not.toContain("allowlisted TODO refs");
    expect(summary).not.toContain("stale TODO ref");
  });

  it("keeps baseline entries tied to review units", () => {
    expect(similarityFalsePositiveBaseline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "browser-overlay-close-vs-sidebar-smart-view-builder",
          classification: "domain-boundary",
        }),
        expect.objectContaining({
          id: "account-cache-patcher-vs-browser-bounds-lifecycle",
          reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
        }),
        expect.objectContaining({
          id: "article-auto-mark-vs-article-list-view-state",
          decision: "Do not share article read mutation lifecycle with pure article-list view-state derivation.",
        }),
        expect.objectContaining({
          id: "subscription-review-candidates-vs-subscription-list-groups",
          decision:
            "Keep subscription review scoring separate from subscription list grouping; only count normalization is shared.",
        }),
      ]),
    );
  });

  it("keeps threshold validation, help text, and command args in sync", () => {
    expect(similarityThresholds).toEqual([0.95, 0.9, 0.87]);
    expect(defaultThreshold).toBe(0.9);
    expect(defaultPath).toBe("src/");
    expect(similarityUsage).toBe("Usage: node scripts/similarity-report.ts [0.95|0.9|0.87] [path]");
    expect(readThreshold(undefined)).toBe(defaultThreshold);
    expect(readThreshold("0.95")).toBe(0.95);
    expect(() => readThreshold("0.5")).toThrow("Unsupported similarity threshold: 0.5. Use 0.95, 0.9, 0.87.");
    expect(() => readThreshold("0.90")).toThrow("Unsupported similarity threshold: 0.90. Use 0.95, 0.9, 0.87.");
    expect(buildSimilarityCommandArgs(0.87, "src/lib")).toEqual([
      "exec",
      "similarity-ts",
      "--threshold",
      "0.87",
      "--exclude",
      "node_modules",
      "--exclude",
      "dist",
      "--exclude",
      "src-tauri/target",
      "--exclude",
      "tmp",
      "--exclude",
      "storybook-static",
      "--exclude",
      "test-results",
      "--exclude",
      "playwright-report",
      "--exclude",
      "src-tauri/gen/schemas",
      "src/lib",
    ]);
  });

  it("keeps generated schemas and target artifacts outside similarity scans", () => {
    expect(similarityScanExcludePatterns).toEqual(
      expect.arrayContaining(["src-tauri/target", "src-tauri/gen/schemas"]),
    );
  });

  it("uses pathToFileURL semantics for direct execution detection", () => {
    const scriptPath = "/tmp/work tree/ユニコード/scripts/similarity-report.ts";
    const scriptUrl = pathToFileURL(scriptPath).href;

    expect(isSimilarityReportEntrypoint(scriptUrl, scriptPath)).toBe(true);
    expect(isSimilarityReportEntrypoint(scriptUrl, "/tmp/work tree/ユニコード/src/importer.ts")).toBe(false);
    expect(isSimilarityReportEntrypoint(scriptUrl, undefined)).toBe(false);
  });

  it("keeps mise report task routed through the package script entrypoint", () => {
    const miseToml = ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(miseToml).toContain('["report:similarity"]');
    expect(miseToml).toContain('run = "pnpm run report:similarity"');
    expect(miseToml).toContain('run_windows = "pnpm.CMD run report:similarity"');
    expect(buildSimilaritySummary.toString()).not.toContain("todoContent");
  });
});
