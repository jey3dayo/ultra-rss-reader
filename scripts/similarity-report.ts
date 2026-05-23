import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const similarityThresholds = [0.95, 0.9, 0.87] as const;
export const defaultThreshold = 0.9;
export const defaultPath = "src/";
export const similarityUsage = `Usage: node scripts/similarity-report.ts [${similarityThresholds.join("|")}] [path]`;
export const similarityScanExcludePatterns = [
  "node_modules",
  "dist",
  "src-tauri/target",
  "tmp",
  "storybook-static",
  "test-results",
  "playwright-report",
  "src-tauri/gen/schemas",
] as const;
const similarityScanBaseline = {
  functionPairs: 42,
  similarTypePairs: 4,
  typeLiteralPairs: 0,
} as const;

type SimilarityThreshold = (typeof similarityThresholds)[number];

export type SimilarityPair = {
  similarityPercent: number;
  score: number;
  averageLines: number;
  firstPath: string;
  firstSymbol: string;
  secondPath: string;
  secondSymbol: string;
};

export type SimilarityTypeSummary = {
  similarTypePairs: number;
  typeLiteralPairs: number;
  totalTypePairs: number;
  reportedTypePairDrift: number;
};

export type SimilarityParseDiagnostics = {
  pairs: SimilarityPair[];
  skippedSimilarityBlocks: number;
};

export type SimilarityReportGateDiagnostic = {
  exitCode: number;
  message: string;
};

type SimilarityFalsePositive = {
  id: string;
  classification: "domain-boundary" | "cache-helper-vs-hook-lifecycle" | "hook-lifecycle-baseline";
  paths: readonly string[];
  symbols: readonly string[];
  decision: string;
  reviewUnit: string;
};

export const similarityFalsePositiveBaseline = [
  {
    id: "article-auto-mark-vs-browser-webview-sync",
    classification: "hook-lifecycle-baseline",
    paths: [
      "src/components/reader/hooks/article/use-article-auto-mark.ts",
      "src/components/reader/hooks/browser/use-browser-webview-sync.ts",
    ],
    symbols: ["useArticleAutoMark", "useBrowserWebviewSync"],
    decision:
      "Do not share auto-read timer/mutation rollback with embedded browser native create/resize/focus lifecycle.",
    reviewUnit: "Review future work inside article auto-marking or browser WebView sync separately.",
  },
  {
    id: "article-auto-mark-vs-browser-overlay-focus-return",
    classification: "hook-lifecycle-baseline",
    paths: [
      "src/components/reader/hooks/article/use-article-auto-mark.ts",
      "src/components/reader/hooks/browser/use-browser-overlay-focus-return.ts",
    ],
    symbols: ["useArticleAutoMark", "useBrowserOverlayFocusReturn"],
    decision: "Do not share auto-read timer/mutation lifecycle with DOM focus-return scheduling.",
    reviewUnit: "Review future work inside article auto-marking or overlay focus-return separately.",
  },
  {
    id: "article-auto-mark-vs-article-list-view-state",
    classification: "domain-boundary",
    paths: [
      "src/components/reader/hooks/article/use-article-auto-mark.ts",
      "src/components/reader/hooks/article-list/use-article-list-view-state.ts",
    ],
    symbols: ["useArticleAutoMark", "useArticleListViewState"],
    decision: "Do not share article read mutation lifecycle with pure article-list view-state derivation.",
    reviewUnit:
      "Review future work inside article mutation lifecycle or article-list view-state derivation separately.",
  },
  {
    id: "article-auto-mark-vs-browser-overlay-close",
    classification: "hook-lifecycle-baseline",
    paths: [
      "src/components/reader/hooks/article/use-article-auto-mark.ts",
      "src/components/reader/hooks/article/use-article-browser-overlay-close.ts",
    ],
    symbols: ["useArticleAutoMark", "useArticleBrowserOverlayClose"],
    decision: "Do not share auto-read timer/mutation lifecycle with browser overlay close in-flight guards.",
    reviewUnit: "Review future work inside article auto-marking or browser overlay close guards separately.",
  },
  {
    id: "browser-overlay-close-vs-sidebar-smart-view-builder",
    classification: "domain-boundary",
    paths: [
      "src/components/reader/hooks/article/use-article-browser-overlay-close.ts",
      "src/lib/sidebar/sidebar-smart-views.ts",
    ],
    symbols: ["useArticleBrowserOverlayClose", "buildSidebarSmartViews"],
    decision: "Do not extract a shared helper across browser close lifecycle and static sidebar view-model building.",
    reviewUnit: "Keep future work scoped to browser close motion guards or sidebar smart-view item mapping separately.",
  },
  {
    id: "account-cache-patcher-vs-browser-bounds-lifecycle",
    classification: "cache-helper-vs-hook-lifecycle",
    paths: [
      "src/components/settings/account-detail/query-cache.ts",
      "src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts",
    ],
    symbols: ["patchCachedAccount", "useBrowserWebviewBoundsSync"],
    decision: "Do not share account cache array mutation with browser layout effect cancellation and native sync.",
    reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
  },
  {
    id: "account-cache-patcher-vs-updater-lifecycle",
    classification: "cache-helper-vs-hook-lifecycle",
    paths: ["src/components/settings/account-detail/query-cache.ts", "src/hooks/use-updater.ts"],
    symbols: ["patchCachedAccount", "useUpdater"],
    decision: "Do not share account cache array mutation with updater startup check and Tauri listener disposal.",
    reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
  },
  {
    id: "browser-bounds-lifecycle-vs-updater-lifecycle",
    classification: "hook-lifecycle-baseline",
    paths: ["src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts", "src/hooks/use-updater.ts"],
    symbols: ["useBrowserWebviewBoundsSync", "useUpdater"],
    decision: "Keep lifecycle hooks separate unless the duplicated unit is only cancellation/disposal plumbing.",
    reviewUnit: "Review with min-lines/min-tokens high enough to exclude tiny callback-shape matches.",
  },
  {
    id: "browser-layout-diagnostics-vs-feed-tree-pointer-drag-events",
    classification: "hook-lifecycle-baseline",
    paths: [
      "src/components/reader/hooks/browser/use-browser-layout-diagnostics.ts",
      "src/components/reader/hooks/feed-tree/use-feed-tree-pointer-drag-events.ts",
    ],
    symbols: ["useBrowserLayoutDiagnostics", "useFeedTreePointerDragEvents"],
    decision: "Do not share browser geometry snapshot state with feed-tree pointer drag window-event lifecycle.",
    reviewUnit: "Review browser diagnostics and feed-tree drag behavior separately.",
  },
  {
    id: "browser-layout-diagnostics-vs-subscription-review-candidates",
    classification: "domain-boundary",
    paths: [
      "src/components/reader/hooks/browser/use-browser-layout-diagnostics.ts",
      "src/lib/subscriptions/subscription-review-candidates.ts",
    ],
    symbols: ["useBrowserLayoutDiagnostics", "buildSubscriptionReviewCandidates"],
    decision: "Do not share browser DOM geometry derivation with subscription health candidate scoring.",
    reviewUnit: "Review browser layout diagnostics and subscription review candidate scoring separately.",
  },
  {
    id: "scroll-overflow-state-vs-subscription-review-candidates",
    classification: "domain-boundary",
    paths: [
      "src/components/settings/hooks/use-scroll-overflow-state.ts",
      "src/lib/subscriptions/subscription-review-candidates.ts",
    ],
    symbols: ["useScrollOverflowState", "buildSubscriptionReviewCandidates"],
    decision: "Do not share scroll overflow observer state with subscription review candidate scoring.",
    reviewUnit: "Review settings scroll overflow and subscription review candidate scoring separately.",
  },
  {
    id: "browser-bounds-lifecycle-vs-sidebar-account-selection",
    classification: "hook-lifecycle-baseline",
    paths: [
      "src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts",
      "src/components/reader/hooks/sidebar/use-sidebar-account-selection.ts",
    ],
    symbols: ["useBrowserWebviewBoundsSync", "useSidebarAccountSelection"],
    decision: "Do not share native browser bounds sync lifecycle with sidebar account selection side effects.",
    reviewUnit: "Review browser WebView bounds sync and sidebar account selection separately.",
  },
  {
    id: "subscription-review-candidates-vs-subscription-list-groups",
    classification: "domain-boundary",
    paths: ["src/lib/subscriptions/subscription-review-candidates.ts", "src/lib/subscriptions/subscriptions-index.ts"],
    symbols: ["buildSubscriptionReviewCandidates", "buildSubscriptionListGroups"],
    decision:
      "Keep subscription review scoring separate from subscription list grouping; only count normalization is shared.",
    reviewUnit: "Review subscription candidate scoring and list grouping separately.",
  },
] as const satisfies readonly SimilarityFalsePositive[];

export function parseSimilarityPairs(output: string): SimilarityPair[] {
  return parseSimilarityOutput(output).pairs;
}

export function parseSimilarityOutput(output: string): SimilarityParseDiagnostics {
  const [functionSimilarityOutput] = output.split(/^=== Type Similarity ===$/m);
  const lines = (functionSimilarityOutput ?? output).split("\n");
  const pairs: SimilarityPair[] = [];
  let skippedSimilarityBlocks = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line?.startsWith("Similarity:")) {
      continue;
    }

    const similarity = line.match(
      /^Similarity: ([0-9.]+)%, Score: ([0-9.]+) points \(lines \d+~\d+, avg: ([0-9.]+)\)$/,
    );
    if (!similarity) {
      skippedSimilarityBlocks += 1;
      continue;
    }

    const first = parseSimilarityPairLine(lines[index + 1]);
    const second = parseSimilarityPairLine(lines[index + 2]);
    if (!first || !second) {
      skippedSimilarityBlocks += 1;
      continue;
    }

    pairs.push({
      similarityPercent: Number(similarity[1]),
      score: Number(similarity[2]),
      averageLines: Number(similarity[3]),
      firstPath: first.path,
      firstSymbol: first.symbol,
      secondPath: second.path,
      secondSymbol: second.symbol,
    });
  }

  return {
    pairs,
    skippedSimilarityBlocks,
  };
}

function parseSimilarityPairLine(line: string | undefined): { path: string; symbol: string } | null {
  const match = line?.trim().match(/^(.+):\d+-\d+(?:\s+(.*))?$/);
  if (!match) {
    return null;
  }

  return {
    path: match[1] ?? "",
    symbol: match[2] ?? "",
  };
}

export function findFalsePositiveMatch(pair: SimilarityPair): SimilarityFalsePositive | null {
  const pairPaths = new Set([pair.firstPath, pair.secondPath]);
  const pairSymbols = new Set([pair.firstSymbol, pair.secondSymbol]);

  return (
    similarityFalsePositiveBaseline.find(
      (item) =>
        item.paths.every((path) => pairPaths.has(path)) && item.symbols.every((symbol) => pairSymbols.has(symbol)),
    ) ?? null
  );
}

export function buildSimilaritySummary(output: string): string {
  const diagnostics = parseSimilarityOutput(output);
  const pairs = diagnostics.pairs;
  const typeSummary = parseSimilarityTypeSummary(output);
  const matchedFalsePositives = pairs.map(findFalsePositiveMatch).filter((item) => item !== null);
  const matchedIds = new Set(matchedFalsePositives.map((item) => item.id));
  const unmatchedFalsePositives = similarityFalsePositiveBaseline.filter((item) => !matchedIds.has(item.id));

  return [
    "Similarity scan baseline",
    `thresholds: ${similarityThresholds.join(" / ")}`,
    `current command: similarity-ts --threshold ${defaultThreshold} ${defaultPath}`,
    `scan excludes: ${similarityScanExcludePatterns.join(" / ")}`,
    "reading rule: use 0.95 for near-copy candidates, 0.9 for TODO triage, and 0.87 for broad discovery.",
    "filtering rule: raise --min-lines/--min-tokens before extracting helpers from tiny callback-shape matches.",
    `function pairs: ${pairs.length}`,
    `unparsed similarity blocks: ${diagnostics.skippedSimilarityBlocks}`,
    `scan baseline function pairs: ${similarityScanBaseline.functionPairs}`,
    `type pairs: ${typeSummary.totalTypePairs} (types: ${typeSummary.similarTypePairs}, type literals: ${typeSummary.typeLiteralPairs})`,
    `type pair report drift: ${typeSummary.reportedTypePairDrift}`,
    `scan baseline type pairs: ${similarityScanBaseline.similarTypePairs + similarityScanBaseline.typeLiteralPairs} (types: ${similarityScanBaseline.similarTypePairs}, type literals: ${similarityScanBaseline.typeLiteralPairs})`,
    `allowlisted false positives present: ${matchedFalsePositives.length}`,
    `allowlisted false positives absent: ${unmatchedFalsePositives.length}`,
    ...matchedFalsePositives.map((item) => `- present ${item.id}: ${item.decision}`),
    ...unmatchedFalsePositives.map((item) => `- absent ${item.id}: ${item.reviewUnit}`),
  ].join("\n");
}

export function evaluateSimilarityReportGate(output: string): SimilarityReportGateDiagnostic | null {
  const parseDiagnostics = parseSimilarityOutput(output);
  const typeSummary = parseSimilarityTypeSummary(output);
  const messages: string[] = [];

  if (parseDiagnostics.skippedSimilarityBlocks > 0) {
    messages.push(`unparsed similarity blocks: ${parseDiagnostics.skippedSimilarityBlocks}`);
  }

  if (typeSummary.reportedTypePairDrift !== 0) {
    messages.push(`type pair report drift: ${typeSummary.reportedTypePairDrift}`);
  }

  if (messages.length === 0) {
    return null;
  }

  return {
    exitCode: 1,
    message: `Similarity report gate failed: ${messages.join("; ")}`,
  };
}

export function parseSimilarityTypeSummary(output: string): SimilarityTypeSummary {
  const totalTypePairs = readOptionalCount(output, /Total similar type pairs found: (\d+)/);
  const similarTypePairs = countTypePairMarkers(output, "(type)");
  const typeLiteralPairs = countTypePairMarkers(output, "(type literal)");

  return {
    similarTypePairs,
    typeLiteralPairs,
    totalTypePairs,
    reportedTypePairDrift: totalTypePairs - similarTypePairs - typeLiteralPairs,
  };
}

function countTypePairMarkers(output: string, marker: string): number {
  return Math.floor(output.split("\n").filter((line) => line.includes(marker)).length / 2);
}

function readOptionalCount(output: string, pattern: RegExp): number {
  const match = output.match(pattern);
  return match === null ? 0 : Number(match[1]);
}

export function readThreshold(rawValue: string | undefined): SimilarityThreshold {
  if (rawValue === undefined) {
    return defaultThreshold;
  }

  if (isSimilarityThreshold(rawValue)) {
    return Number(rawValue) as SimilarityThreshold;
  }

  throw new Error(`Unsupported similarity threshold: ${rawValue}. Use ${similarityThresholds.join(", ")}.`);
}

function isSimilarityThreshold(rawValue: string): rawValue is `${SimilarityThreshold}` {
  return similarityThresholds.some((threshold) => rawValue === String(threshold));
}

export function buildSimilarityCommandArgs(threshold: SimilarityThreshold, targetPath: string): string[] {
  return [
    "exec",
    "similarity-ts",
    "--threshold",
    String(threshold),
    ...similarityScanExcludePatterns.flatMap((pattern) => ["--exclude", pattern]),
    targetPath,
  ];
}

export function runSimilarityReport(args: readonly string[] = process.argv.slice(2)): void {
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(similarityUsage);
    console.log("Thresholds: 0.95 near-copy, 0.9 TODO triage, 0.87 broad discovery.");
    return;
  }

  const threshold = readThreshold(args[0]);
  const targetPath = args[1] ?? defaultPath;
  const result = spawnSync("pnpm", buildSimilarityCommandArgs(threshold, targetPath), {
    encoding: "utf8",
  });

  if (result.error !== undefined) {
    process.stderr.write(`Failed to run similarity-ts via pnpm: ${result.error.message}\n`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`similarity-ts exited with status ${result.status ?? "unknown"}.\n`);
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(result.stdout);
  process.stdout.write("\n");
  const summary = buildSimilaritySummary(result.stdout);
  process.stdout.write(summary);
  process.stdout.write("\n");

  const gateDiagnostic = evaluateSimilarityReportGate(result.stdout);
  if (gateDiagnostic !== null) {
    process.stderr.write(`${gateDiagnostic.message}\n`);
    process.exit(gateDiagnostic.exitCode);
  }
}

export function isSimilarityReportEntrypoint(importMetaUrl: string, argvPath: string | undefined): boolean {
  return typeof argvPath === "string" && importMetaUrl === pathToFileURL(argvPath).href;
}

const isMainModule = isSimilarityReportEntrypoint(import.meta.url, process.argv[1]);

if (isMainModule) {
  runSimilarityReport();
}
