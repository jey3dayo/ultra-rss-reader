import { useMemo } from "react";
import { useSearchArticles } from "@/hooks/use-articles";
import { getHistory } from "@/hooks/use-command-history";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import type { PaletteAction, UseCommandPaletteDataParams, UseCommandPaletteDataResult } from "./command-palette.types";
import type { CommandPaletteHistoryEntry } from "./command-palette-history";
import { parseCommandPaletteHistoryEntry } from "./command-palette-history";

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchesQuery(label: string, keywords: readonly string[], query: string): boolean {
  if (!query) {
    return true;
  }

  const needle = normalize(query);
  return [label, ...keywords].some((value) => normalize(value).includes(needle));
}

function filterByQuery<T>(
  items: T[],
  query: string,
  selectors: {
    label: (item: T) => string;
    keywords: (item: T) => readonly string[];
  },
): T[] {
  return items.filter((item) => matchesQuery(selectors.label(item), selectors.keywords(item), query));
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
  } = params;

  return [
    showRecentActions && recentActionsCount > 0,
    !showRecentActions && showActions && filteredActionsCount > 0,
    !showRecentActions && showDevScenarios && filteredDevScenariosCount > 0,
    !showRecentActions && showFeeds && filteredFeedsCount > 0,
    !showRecentActions && showTags && filteredTagsCount > 0,
    !showRecentActions && showArticles && articlesCount > 0,
  ].some(Boolean);
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

  const recentActions = useMemo(() => {
    const actionMap = new Map(actions.map((action) => [action.id, action]));
    return getHistory()
      .map(parseCommandPaletteHistoryEntry)
      .filter((entry): entry is Extract<CommandPaletteHistoryEntry, { kind: "action" }> => entry?.kind === "action")
      .map((entry) => actionMap.get(entry.id))
      .filter((action): action is PaletteAction => action != null);
  }, [actions]);

  const showRecentActions = prefix === null && query.length === 0 && recentActions.length > 0;
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
  });

  return {
    articles,
    filteredActions,
    filteredDevScenarios,
    filteredFeeds,
    filteredTags,
    recentActions,
    showRecentActions,
    showActions,
    showDevScenarios,
    showFeeds,
    showTags,
    showArticles,
    hasVisibleResults,
  };
}
