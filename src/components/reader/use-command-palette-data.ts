import { useMemo } from "react";
import { useSearchArticles } from "@/hooks/use-articles";
import { getHistory } from "@/hooks/use-command-history";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import type { AppAction } from "@/lib/actions";
import type { RuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type { CommandPaletteActionItem } from "./command-palette-results";

export type PaletteAction = CommandPaletteActionItem & {
  keywords: string[];
};

type HistoryEntry = { kind: "action"; id: AppAction } | { kind: "feed" | "tag" | "article"; id: string };

export const COMMAND_PALETTE_HISTORY_PREFIX = {
  action: "action:",
  feed: "feed:",
  tag: "tag:",
  article: "article:",
} as const;

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

function parseHistoryEntry(value: string): HistoryEntry | null {
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.action)) {
    return {
      kind: "action",
      id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.action.length) as AppAction,
    };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.feed)) {
    return { kind: "feed", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.feed.length) };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.tag)) {
    return { kind: "tag", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.tag.length) };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.article)) {
    return { kind: "article", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.article.length) };
  }
  return null;
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
      .map(parseHistoryEntry)
      .filter((entry): entry is Extract<HistoryEntry, { kind: "action" }> => entry?.kind === "action")
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
