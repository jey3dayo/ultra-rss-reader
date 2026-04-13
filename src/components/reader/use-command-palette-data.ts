import { useMemo } from "react";
import { useSearchArticles } from "@/hooks/use-articles";
import { getHistory } from "@/hooks/use-command-history";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { parseCommandPaletteHistoryEntry } from "./command-palette-history";
import type { CommandPaletteActionItem } from "./command-palette.types";

export type PaletteAction = CommandPaletteActionItem & {
  keywords: string[];
};

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

type UseCommandPaletteDataOptions = {
  actions: PaletteAction[];
  deferredQuery: string;
  devScenarios: RuntimeDevScenario[];
  prefix: string | null;
  query: string;
  selectedAccountId: string | null;
};

export function useCommandPaletteData({
  actions,
  deferredQuery,
  devScenarios,
  prefix,
  query,
  selectedAccountId,
}: UseCommandPaletteDataOptions) {
  const { data: feeds = [] } = useFeeds(selectedAccountId ?? "");
  const { data: tags = [] } = useTags();
  const { data: articles = [] } = useSearchArticles(selectedAccountId, prefix === null ? deferredQuery : "");

  const filteredActions = useMemo(
    () => actions.filter((action) => matchesQuery(action.label, action.keywords, query)),
    [actions, query],
  );
  const filteredDevScenarios = useMemo(
    () => devScenarios.filter((scenario) => matchesQuery(scenario.title, scenario.keywords, query)),
    [devScenarios, query],
  );
  const filteredFeeds = useMemo(
    () => feeds.filter((feed) => matchesQuery(feed.title, [feed.url, feed.site_url], query)),
    [feeds, query],
  );
  const filteredTags = useMemo(() => tags.filter((tag) => matchesQuery(tag.name, [], query)), [tags, query]);

  const recentActions = useMemo(() => {
    const actionMap = new Map(actions.map((action) => [action.id, action]));
    return getHistory()
      .map(parseCommandPaletteHistoryEntry)
      .filter((entry): entry is Extract<NonNullable<ReturnType<typeof parseCommandPaletteHistoryEntry>>, { kind: "action" }> => entry?.kind === "action")
      .map((entry) => actionMap.get(entry.id))
      .filter((action): action is PaletteAction => action != null);
  }, [actions]);

  const showRecentActions = prefix === null && query.length === 0 && recentActions.length > 0;
  const showActions = prefix === null || prefix === ">";
  const showDevScenarios = import.meta.env.DEV && prefix === null;
  const showFeeds = prefix === null || prefix === "@";
  const showTags = prefix === null || prefix === "#";
  const showArticles = prefix === null;

  const hasVisibleResults = [
    showRecentActions && recentActions.length > 0,
    !showRecentActions && showActions && filteredActions.length > 0,
    !showRecentActions && showDevScenarios && filteredDevScenarios.length > 0,
    !showRecentActions && showFeeds && filteredFeeds.length > 0,
    !showRecentActions && showTags && filteredTags.length > 0,
    !showRecentActions && showArticles && articles.length > 0,
  ].some(Boolean);

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
