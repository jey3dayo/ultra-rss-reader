import { spawnSync } from "node:child_process";

const similarityThresholds = [0.95, 0.9, 0.87] as const;
const defaultThreshold = 0.9;
const defaultPath = "src/";

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
    const similarity = lines[index]?.match(
      /^Similarity: ([0-9.]+)%, Score: ([0-9.]+) points \(lines \d+~\d+, avg: ([0-9.]+)\)$/,
    );
    if (!similarity) {
      continue;
    }

    const first = lines[index + 1]?.trim().match(/^(.+):\d+-\d+ (.+)$/);
    const second = lines[index + 2]?.trim().match(/^(.+):\d+-\d+ (.+)$/);
    if (!first || !second) {
      continue;
    }

    pairs.push({
      similarityPercent: Number(similarity[1]),
      score: Number(similarity[2]),
      averageLines: Number(similarity[3]),
      firstPath: first[1] ?? "",
      firstSymbol: first[2] ?? "",
      secondPath: second[1] ?? "",
      secondSymbol: second[2] ?? "",
    });
  }

  return pairs;
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
    `allowlisted false positives present: ${matchedFalsePositives.length}`,
    `allowlisted false positives absent: ${unmatchedFalsePositives.length}`,
    ...matchedFalsePositives.map((item) => `- present ${item.id}: ${item.decision}`),
    ...unmatchedFalsePositives.map((item) => `- absent ${item.id}: ${item.reviewUnit}`),
  ].join("\n");
}

function readThreshold(rawValue: string | undefined): SimilarityThreshold {
  if (rawValue === undefined) {
    return defaultThreshold;
  }

  const parsed = Number(rawValue);
  if (similarityThresholds.includes(parsed as SimilarityThreshold)) {
    return parsed as SimilarityThreshold;
  }

  throw new Error(`Unsupported similarity threshold: ${rawValue}. Use ${similarityThresholds.join(", ")}.`);
}

function runSimilarityReport(): void {
  const threshold = readThreshold(process.argv[2]);
  const targetPath = process.argv[3] ?? defaultPath;
  const result = spawnSync("pnpm", ["exec", "similarity-ts", "--threshold", String(threshold), targetPath], {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runSimilarityReport();
}
