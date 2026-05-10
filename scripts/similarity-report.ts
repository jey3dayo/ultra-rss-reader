import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const similarityThresholds = [0.95, 0.9, 0.87] as const;
export const defaultThreshold = 0.9;
export const defaultPath = "src/";
export const similarityUsage = `Usage: node scripts/similarity-report.ts [${similarityThresholds.join("|")}] [path]`;
const todoSimilarityBaseline = {
  functionPairs: 32,
  similarTypePairs: 1,
  typeLiteralPairs: 2,
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
};

type SimilarityFalsePositive = {
  id: string;
  todoName: string;
  classification: "domain-boundary" | "cache-helper-vs-hook-lifecycle" | "hook-lifecycle-baseline";
  paths: readonly string[];
  symbols: readonly string[];
  decision: string;
  reviewUnit: string;
};

export const similarityFalsePositiveBaseline = [
  {
    id: "browser-overlay-close-vs-sidebar-smart-view-builder",
    todoName:
      "P2 similarity 90.42%: browser overlay close と sidebar smart view builder の structural false positive を guard する",
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
    id: "account-cache-updater-vs-browser-bounds-lifecycle",
    todoName: "P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する",
    classification: "cache-helper-vs-hook-lifecycle",
    paths: [
      "src/components/settings/account-detail/query-cache.ts",
      "src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts",
    ],
    symbols: ["upsertCachedAccount", "useBrowserWebviewBoundsSync"],
    decision: "Do not share account cache array mutation with browser layout effect cancellation and native sync.",
    reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
  },
  {
    id: "account-cache-updater-vs-updater-lifecycle",
    todoName: "P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する",
    classification: "cache-helper-vs-hook-lifecycle",
    paths: ["src/components/settings/account-detail/query-cache.ts", "src/hooks/use-updater.ts"],
    symbols: ["upsertCachedAccount", "useUpdater"],
    decision: "Do not share account cache array mutation with updater startup check and Tauri listener disposal.",
    reviewUnit: "Treat cache helpers as standalone data updates; investigate only large hook lifecycle pairs.",
  },
  {
    id: "browser-bounds-lifecycle-vs-updater-lifecycle",
    todoName: "P3 similarity 90.39%: account cache updater と hook lifecycle false positive を共通化しないよう分類する",
    classification: "hook-lifecycle-baseline",
    paths: ["src/components/reader/hooks/browser/use-browser-webview-bounds-sync.ts", "src/hooks/use-updater.ts"],
    symbols: ["useBrowserWebviewBoundsSync", "useUpdater"],
    decision: "Keep lifecycle hooks separate unless the duplicated unit is only cancellation/disposal plumbing.",
    reviewUnit: "Review with min-lines/min-tokens high enough to exclude tiny callback-shape matches.",
  },
] as const satisfies readonly SimilarityFalsePositive[];

export function parseSimilarityPairs(output: string): SimilarityPair[] {
  const lines = output.split("\n");
  const pairs: SimilarityPair[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const similarity = lines[index]
      ?.trim()
      .match(/^Similarity: ([0-9.]+)%, Score: ([0-9.]+) points \(lines \d+~\d+, avg: ([0-9.]+)\)$/);
    if (!similarity) {
      continue;
    }

    const first = parseSimilarityPairLine(lines[index + 1]);
    const second = parseSimilarityPairLine(lines[index + 2]);
    if (!first || !second) {
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

  return pairs;
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
  const pairs = parseSimilarityPairs(output);
  const typeSummary = parseSimilarityTypeSummary(output);
  const matchedFalsePositives = pairs.map(findFalsePositiveMatch).filter((item) => item !== null);
  const matchedIds = new Set(matchedFalsePositives.map((item) => item.id));
  const unmatchedFalsePositives = similarityFalsePositiveBaseline.filter((item) => !matchedIds.has(item.id));

  return [
    "Similarity scan baseline",
    `thresholds: ${similarityThresholds.join(" / ")}`,
    `current command: similarity-ts --threshold ${defaultThreshold} ${defaultPath}`,
    "reading rule: use 0.95 for near-copy candidates, 0.9 for TODO triage, 0.87 for broad discovery.",
    "filtering rule: raise --min-lines/--min-tokens before extracting helpers from tiny callback-shape matches.",
    `function pairs: ${pairs.length}`,
    `TODO baseline function pairs: ${todoSimilarityBaseline.functionPairs}`,
    `type pairs: ${typeSummary.totalTypePairs} (types: ${typeSummary.similarTypePairs}, type literals: ${typeSummary.typeLiteralPairs})`,
    `TODO baseline type pairs: ${todoSimilarityBaseline.similarTypePairs + todoSimilarityBaseline.typeLiteralPairs} (types: ${todoSimilarityBaseline.similarTypePairs}, type literals: ${todoSimilarityBaseline.typeLiteralPairs})`,
    `allowlisted false positives present: ${matchedFalsePositives.length}`,
    `allowlisted false positives absent: ${unmatchedFalsePositives.length}`,
    ...matchedFalsePositives.map((item) => `- present ${item.id}: ${item.decision}`),
    ...unmatchedFalsePositives.map((item) => `- absent ${item.id}: ${item.reviewUnit}`),
  ].join("\n");
}

export function parseSimilarityTypeSummary(output: string): SimilarityTypeSummary {
  const totalTypePairs = readOptionalCount(output, /Total similar type pairs found: (\d+)/);
  const similarTypePairs = countTypePairMarkers(output, "(type)");
  const typeLiteralPairs = countTypePairMarkers(output, "(type literal)");

  return {
    similarTypePairs,
    typeLiteralPairs,
    totalTypePairs,
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

  const parsed = Number(rawValue);
  if (similarityThresholds.includes(parsed as SimilarityThreshold)) {
    return parsed as SimilarityThreshold;
  }

  throw new Error(`Unsupported similarity threshold: ${rawValue}. Use ${similarityThresholds.join(", ")}.`);
}

export function buildSimilarityCommandArgs(threshold: SimilarityThreshold, targetPath: string): string[] {
  return ["exec", "similarity-ts", "--threshold", String(threshold), targetPath];
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

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(result.stdout);
  process.stdout.write("\n");
  process.stdout.write(buildSimilaritySummary(result.stdout));
  process.stdout.write("\n");
}

export function isSimilarityReportEntrypoint(importMetaUrl: string, argvPath: string | undefined): boolean {
  return typeof argvPath === "string" && importMetaUrl === pathToFileURL(argvPath).href;
}

const isMainModule = isSimilarityReportEntrypoint(import.meta.url, process.argv[1]);

if (isMainModule) {
  runSimilarityReport();
}
