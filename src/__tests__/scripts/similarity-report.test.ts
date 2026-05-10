import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSimilarityCommandArgs,
  buildSimilaritySummary,
  defaultPath,
  defaultThreshold,
  findFalsePositiveMatch,
  findStaleFalsePositiveTodoRefs,
  isSimilarityReportEntrypoint,
  parseSimilarityOutput,
  parseSimilarityPairs,
  readThreshold,
  similarityFalsePositiveBaseline,
  similarityThresholds,
  similarityUsage,
} from "../../../scripts/similarity-report";

const sampleReport = `
Similarity: 92.07%, Score: 56.6 points (lines 61~62, avg: 61.5)
  src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts:65-125 useBrowserWebviewBoundsSync
  src/hooks/use-updater.ts:267-328 useUpdater

Similarity: 90.39%, Score: 33.9 points (lines 14~61, avg: 37.5)
  src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts:65-125 useBrowserWebviewBoundsSync
  src/components/settings/account-detail/query-cache.ts:10-23 upsertCachedAccount
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
        secondSymbol: "upsertCachedAccount",
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

  it("reports absent allowlist entries so stale TODO baselines are visible", () => {
    const summary = buildSimilaritySummary(sampleReport);

    expect(summary).toContain("thresholds: 0.95 / 0.9 / 0.87");
    expect(summary).toContain("unparsed similarity blocks: 0");
    expect(summary).toContain("allowlisted false positives present: 2");
    expect(summary).toContain("allowlisted false positives absent: 2");
    expect(summary).toContain("absent browser-overlay-close-vs-sidebar-smart-view-builder");
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
  });

  it("reports stale false-positive TODO references when TODO content is provided", () => {
    const todoContent = [
      "P2 similarity 90.42%: browser overlay close と sidebar smart view builder の structural false positive を guard する",
      "P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する",
    ].join("\n");

    expect(findStaleFalsePositiveTodoRefs(todoContent)).toEqual([]);
    expect(findStaleFalsePositiveTodoRefs("P2 renamed similarity cleanup")).toHaveLength(4);

    const summary = buildSimilaritySummary(sampleReport, "P2 renamed similarity cleanup");

    expect(summary).toContain("allowlisted TODO refs present: 0");
    expect(summary).toContain("allowlisted TODO refs stale: 4");
    expect(summary).toContain("stale TODO ref browser-overlay-close-vs-sidebar-smart-view-builder");
  });

  it("keeps baseline entries tied to TODO names and review units", () => {
    expect(similarityFalsePositiveBaseline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "browser-overlay-close-vs-sidebar-smart-view-builder",
          todoName:
            "P2 similarity 90.42%: browser overlay close と sidebar smart view builder の structural false positive を guard する",
          classification: "domain-boundary",
        }),
        expect.objectContaining({
          id: "account-cache-updater-vs-browser-bounds-lifecycle",
          reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
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
    expect(buildSimilarityCommandArgs(0.87, "src/lib")).toEqual([
      "exec",
      "similarity-ts",
      "--threshold",
      "0.87",
      "src/lib",
    ]);
  });

  it("uses pathToFileURL semantics for direct execution detection", () => {
    const scriptPath = "/tmp/work tree/ユニコード/scripts/similarity-report.ts";
    const scriptUrl = pathToFileURL(scriptPath).href;

    expect(isSimilarityReportEntrypoint(scriptUrl, scriptPath)).toBe(true);
    expect(isSimilarityReportEntrypoint(scriptUrl, "/tmp/work tree/ユニコード/src/importer.ts")).toBe(false);
    expect(isSimilarityReportEntrypoint(scriptUrl, undefined)).toBe(false);
  });

  it("keeps mise report task routed through the package script entrypoint", () => {
    const miseToml = readFileSync("mise.toml", "utf8");

    expect(miseToml).toContain('[tasks."report:similarity"]');
    expect(miseToml).toContain('run = "pnpm run report:similarity"');
    expect(miseToml).toContain('run_windows = "pnpm.CMD run report:similarity"');
  });
});
