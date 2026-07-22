import { useEffect, useMemo } from "react";
import type { ArticleDto, FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import type { RuntimeDevScenario } from "@/dev/scenario-runtime";
import { useRecentArticles, useSearchArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useTags } from "@/hooks/use-tags";
import {
  type CommandPaletteHistoryEntry,
  parseCommandPaletteHistoryEntry,
} from "@/lib/command-palette/command-history";
import {
  getHistory,
  projectCommandHistoryForExistingEntries,
  writeNormalizedHistoryAfterResourceProjection,
} from "@/lib/command-palette/command-history-storage";
import type { PaletteAction } from "../../command-palette.types";

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
  filteredFolders: FolderDto[];
  filteredTags: TagDto[];
  recentFeeds: FeedDto[];
  recentFolders: FolderDto[];
  recentTags: TagDto[];
  recentArticles: ArticleDto[];
  recentActions: PaletteAction[];
  selectableArticleFeedIds: ReadonlySet<string>;
  selectableArticleIds: ReadonlySet<string>;
  selectableTagIds: ReadonlySet<string>;
  selectableFolderIds: ReadonlySet<string>;
  showRecentActions: boolean;
  showRecentResources: boolean;
  showActions: boolean;
  showDevScenarios: boolean;
  showFeeds: boolean;
  showFolders: boolean;
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

function hasFetchedData(query: { data: unknown; isFetched?: boolean }): boolean {
  return query.isFetched === true || query.data !== undefined;
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
  showFolders: boolean;
  filteredFoldersCount: number;
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
    showFolders,
    filteredFoldersCount,
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
    (showFolders && filteredFoldersCount > 0) ||
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
  const feedsQuery = useFeeds(selectedAccountId);
  const foldersQuery = useFolders(selectedAccountId);
  const tagsQuery = useTags();
  const { data: searchArticleCandidates = [] } = useSearchArticles(
    selectedAccountId,
    prefix === null ? deferredQuery : "",
  );
  const recentArticlesQuery = useRecentArticles(selectedAccountId);
  const feeds = feedsQuery.data ?? [];
  const folders = foldersQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const currentFeedIds = useMemo(() => new Set(feeds.map((feed) => feed.id)), [feeds]);
  const articles = useMemo(
    () => searchArticleCandidates.filter((article) => currentFeedIds.has(article.feed_id)),
    [currentFeedIds, searchArticleCandidates],
  );
  const recentArticleCandidates = useMemo(
    () => (recentArticlesQuery.data ?? []).filter((article) => currentFeedIds.has(article.feed_id)),
    [currentFeedIds, recentArticlesQuery.data],
  );
  const selectableArticleIds = useMemo(
    () => new Set([...articles, ...recentArticleCandidates].map((article) => article.id)),
    [articles, recentArticleCandidates],
  );
  const selectableTagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);
  const selectableFolderIds = useMemo(() => new Set(folders.map((folder) => folder.id)), [folders]);

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
  const filteredFolders = useMemo(
    () => filterByQuery(folders, query, { label: (folder) => folder.name, keywords: () => [] }),
    [folders, query],
  );
  const filteredTags = useMemo(
    () => filterByQuery(tags, query, { label: (tag) => tag.name, keywords: () => [] }),
    [tags, query],
  );

  const { recentActions, recentFeeds, recentFolders, recentTags, recentArticles, historyProjection } = useMemo(() => {
    const resourcesReady =
      hasFetchedData(feedsQuery) &&
      hasFetchedData(foldersQuery) &&
      hasFetchedData(tagsQuery) &&
      hasFetchedData(recentArticlesQuery);

    const actionMap = new Map(actions.map((action) => [action.id, action]));
    const feedMap = new Map(feeds.map((feed) => [feed.id, feed]));
    const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
    const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
    const articleMap = new Map(recentArticleCandidates.map((article) => [article.id, article]));
    const history = getHistory();
    const historyEntries = resourcesReady
      ? projectCommandHistoryForExistingEntries(
          history,
          new Set<string>([
            ...actions.map((action) => `action:${action.id}`),
            ...feeds.map((feed) => `feed:${feed.id}`),
            ...folders.map((folder) => `folder:${folder.id}`),
            ...tags.map((tag) => `tag:${tag.id}`),
            ...recentArticleCandidates.map((article) => `article:${article.id}`),
          ]),
        )
      : history;
    const historyProjection = resourcesReady ? { previous: history, next: historyEntries } : null;
    const entries: CommandPaletteHistoryEntry[] = [];
    for (const historyEntry of historyEntries) {
      const entry = parseCommandPaletteHistoryEntry(historyEntry);
      if (entry !== null) {
        entries.push(entry);
      }
    }

    const recentActions: PaletteAction[] = [];
    const recentFeeds: FeedDto[] = [];
    const recentFolders: FolderDto[] = [];
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

      if (!resourcesReady) {
        continue;
      }

      if (entry.kind === "feed") {
        const feed = feedMap.get(entry.id);
        if (feed) {
          recentFeeds.push(feed);
        }
        continue;
      }

      if (entry.kind === "folder") {
        const folder = folderMap.get(entry.id);
        if (folder) {
          recentFolders.push(folder);
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

    return { recentActions, recentFeeds, recentFolders, recentTags, recentArticles, historyProjection };
  }, [
    actions,
    feeds,
    feedsQuery,
    folders,
    foldersQuery,
    recentArticleCandidates,
    recentArticlesQuery,
    tags,
    tagsQuery,
  ]);

  useEffect(() => {
    if (!historyProjection) {
      return;
    }

    writeNormalizedHistoryAfterResourceProjection(historyProjection.previous, historyProjection.next);
  }, [historyProjection]);

  const showRecentActions = prefix === null && query.length === 0 && recentActions.length > 0;
  const recentResourcesCount = recentFeeds.length + recentFolders.length + recentTags.length + recentArticles.length;
  const showRecentResources = prefix === null && query.length === 0 && recentResourcesCount > 0;
  const showActions = prefix === null || prefix === ">";
  const showDevScenarios = import.meta.env.DEV && prefix === null;
  const showFeeds = prefix === null || prefix === "@";
  const showFolders = prefix === null || prefix === "@";
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
    showFolders,
    filteredFoldersCount: filteredFolders.length,
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
    filteredFolders,
    filteredTags,
    recentFeeds,
    recentFolders,
    recentTags,
    recentArticles,
    recentActions,
    selectableArticleFeedIds: currentFeedIds,
    selectableArticleIds,
    selectableTagIds,
    selectableFolderIds,
    showRecentActions,
    showRecentResources,
    showActions,
    showDevScenarios,
    showFeeds,
    showFolders,
    showTags,
    showArticles,
    hasVisibleResults,
  };
}
