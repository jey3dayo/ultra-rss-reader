import { describe, expect, it } from "vitest";
import {
  buildSimilaritySummary,
  findFalsePositiveMatch,
  parseSimilarityPairs,
  similarityFalsePositiveBaseline,
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
    expect(summary).toContain("allowlisted false positives present: 2");
    expect(summary).toContain("allowlisted false positives absent: 2");
    expect(summary).toContain("absent browser-overlay-close-vs-sidebar-smart-view-builder");
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
});
