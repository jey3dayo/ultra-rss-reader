import { useMemo } from "react";
import type { ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import { normalizeCommandHistoryForExistingEntries } from "@/components/reader/hooks/command-palette/use-command-history";
import type { RuntimeDevScenario } from "@/dev/scenario-runtime";
import { useRecentArticles, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import type { PaletteAction } from "../../command-palette.types";
import type { CommandPaletteHistoryEntry } from "../../command-palette-history";
import { parseCommandPaletteHistoryEntry } from "../../command-palette-history";

type UseCommandPaletteDataParams = {
  actions: PaletteAction[];
  deferredQuery: string;
  devScenarios: RuntimeDevScenario[];
  prefix: string | null;
  query: string;
  selectedAccountId: string | null;
};

type UseCommandPaletteDataResult = {
  articles: ArticleDto[];
  filteredActions: PaletteAction[];
  filteredDevScenarios: RuntimeDevScenario[];
  filteredFeeds: FeedDto[];
  filteredTags: TagDto[];
  recentFeeds: FeedDto[];
  recentTags: TagDto[];
  recentArticles: ArticleDto[];
  recentActions: PaletteAction[];
  showRecentActions: boolean;
  showRecentResources: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showTags: boolean;
  showArticles: boolean;
  hasVisibleResults: boolean;
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchesNormalizedQuery(label: string, keywords: readonly string[], normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (normalize(label).includes(normalizedQuery)) {
    return true;
  }

  return keywords.some((value) => normalize(value).includes(normalizedQuery));
}

function filterByQuery<T>(
  items: T[],
  query: string,
  selectors: {
    label: (item: T) => string;
    keywords: (item: T) => readonly string[];
  },
): T[] {
  const normalizedQuery = normalize(query);
  return items.filter((item) =>
    matchesNormalizedQuery(selectors.label(item), selectors.keywords(item), normalizedQuery),
  );
}

function resolveHasVisiblePaletteResults(params: {
  showRecentActions: boolean;
  recentActionsCount: number;
  showActions: boolean;
  filteredActionsCount: number;
  showDevScenarios: boolean;
  filteredDevScenariosCount: number;
  showFeeds: boolean;
  filteredFeedsCount: number;
  showTags: boolean;
  filteredTagsCount: number;
  showArticles: boolean;
  articlesCount: number;
  showRecentResources: boolean;
  recentResourcesCount: number;
}): boolean {
  const {
    showRecentActions,
    recentActionsCount,
    showActions,
    filteredActionsCount,
    showDevScenarios,
    filteredDevScenariosCount,
    showFeeds,
    filteredFeedsCount,
    showTags,
    filteredTagsCount,
    showArticles,
    articlesCount,
    showRecentResources,
    recentResourcesCount,
  } = params;

  if (showRecentActions) {
    return recentActionsCount > 0 || recentResourcesCount > 0;
  }

  if (showRecentResources) {
    return recentResourcesCount > 0;
  }

  return (
    (showActions && filteredActionsCount > 0) ||
    (showDevScenarios && filteredDevScenariosCount > 0) ||
    (showFeeds && filteredFeedsCount > 0) ||
    (showTags && filteredTagsCount > 0) ||
    (showArticles && articlesCount > 0)
  );
}

export function useCommandPaletteData({
  actions,
  deferredQuery,
  devScenarios,
  prefix,
  query,
  selectedAccountId,
}: UseCommandPaletteDataParams): UseCommandPaletteDataResult {
  const { data: feeds = [] } = useFeeds(selectedAccountId);
  const { data: tags = [] } = useTags();
  const { data: articles = [] } = useSearchArticles(selectedAccountId, prefix === null ? deferredQuery : "");
  const { data: recentArticleCandidates = [] } = useRecentArticles(selectedAccountId);

  const filteredActions = useMemo(
    () => filterByQuery(actions, query, { label: (action) => action.label, keywords: (action) => action.keywords }),
    [actions, query],
  );
  const filteredDevScenarios = useMemo(
    () =>
      filterByQuery(devScenarios, query, {
        label: (scenario) => scenario.title,
        keywords: (scenario) => scenario.keywords,
      }),
    [devScenarios, query],
  );
  const filteredFeeds = useMemo(
    () => filterByQuery(feeds, query, { label: (feed) => feed.title, keywords: (feed) => [feed.url, feed.site_url] }),
    [feeds, query],
  );
  const filteredTags = useMemo(
    () => filterByQuery(tags, query, { label: (tag) => tag.name, keywords: () => [] }),
    [tags, query],
  );

  const { recentActions, recentFeeds, recentTags, recentArticles } = useMemo(() => {
    const actionMap = new Map(actions.map((action) => [action.id, action]));
    const feedMap = new Map(feeds.map((feed) => [feed.id, feed]));
    const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
    const articleMap = new Map(recentArticleCandidates.map((article) => [article.id, article]));
    const existingEntryKeys = new Set<string>([
      ...actions.map((action) => `action:${action.id}`),
      ...feeds.map((feed) => `feed:${feed.id}`),
      ...tags.map((tag) => `tag:${tag.id}`),
      ...recentArticleCandidates.map((article) => `article:${article.id}`),
    ]);
    const entries: CommandPaletteHistoryEntry[] = [];
    for (const historyEntry of normalizeCommandHistoryForExistingEntries(existingEntryKeys)) {
      const entry = parseCommandPaletteHistoryEntry(historyEntry);
      if (entry !== null) {
        entries.push(entry);
      }
    }

    const recentActions: PaletteAction[] = [];
    const recentFeeds: FeedDto[] = [];
    const recentTags: TagDto[] = [];
    const recentArticles: ArticleDto[] = [];
    const projectedEntryKeys = new Set<string>();

    for (const entry of entries) {
      const entryKey = `${entry.kind}:${entry.id}`;
      if (projectedEntryKeys.has(entryKey)) {
        continue;
      }
      projectedEntryKeys.add(entryKey);

      if (entry.kind === "action") {
        const action = actionMap.get(entry.id);
        if (action) {
          recentActions.push(action);
        }
        continue;
      }

      if (entry.kind === "feed") {
        const feed = feedMap.get(entry.id);
        if (feed) {
          recentFeeds.push(feed);
        }
        continue;
      }

      if (entry.kind === "tag") {
        const tag = tagMap.get(entry.id);
        if (tag) {
          recentTags.push(tag);
        }
        continue;
      }

      const article = articleMap.get(entry.id);
      if (article) {
        recentArticles.push(article);
      }
    }

    return { recentActions, recentFeeds, recentTags, recentArticles };
  }, [actions, feeds, recentArticleCandidates, tags]);

  const showRecentActions = prefix === null && query.length === 0 && recentActions.length > 0;
  const recentResourcesCount = recentFeeds.length + recentTags.length + recentArticles.length;
  const showRecentResources = prefix === null && query.length === 0 && recentResourcesCount > 0;
  const showActions = prefix === null || prefix === ">";
  const showDevScenarios = import.meta.env.DEV && prefix === null;
  const showFeeds = prefix === null || prefix === "@";
  const showTags = prefix === null || prefix === "#";
  const showArticles = prefix === null;

  const hasVisibleResults = resolveHasVisiblePaletteResults({
    showRecentActions,
    recentActionsCount: recentActions.length,
    showActions,
    filteredActionsCount: filteredActions.length,
    showDevScenarios,
    filteredDevScenariosCount: filteredDevScenarios.length,
    showFeeds,
    filteredFeedsCount: filteredFeeds.length,
    showTags,
    filteredTagsCount: filteredTags.length,
    showArticles,
    articlesCount: articles.length,
    showRecentResources,
    recentResourcesCount,
  });

  return {
    articles,
    filteredActions,
    filteredDevScenarios,
    filteredFeeds,
    filteredTags,
    recentFeeds,
    recentTags,
    recentArticles,
    recentActions,
    showRecentActions,
    showRecentResources,
    showActions,
    showDevScenarios,
    showFeeds,
    showTags,
    showArticles,
    hasVisibleResults,
  };
}
