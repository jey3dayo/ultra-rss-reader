import { FlaskConicalIcon, HashIcon, NewspaperIcon, RefreshCwIcon, RssIcon, SettingsIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchArticles } from "@/hooks/use-articles";
import { addToHistory, getHistory } from "@/hooks/use-command-history";
import { useCommandSearch } from "@/hooks/use-command-search";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { useFeeds } from "@/hooks/use-feeds";
import { useTags } from "@/hooks/use-tags";
import type { AppAction } from "@/lib/actions";
import { executeAction } from "@/lib/actions";
import { loadRuntimeDevScenarios, type RuntimeDevScenario, runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { getShortcutDisplay } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

type PaletteAction = {
  id: AppAction;
  label: string;
  shortcut?: string;
  keywords: string[];
  icon: typeof SettingsIcon;
};

type HistoryEntry = { kind: "action"; id: AppAction } | { kind: "feed" | "tag" | "article"; id: string };

const HISTORY_PREFIX = {
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
  if (value.startsWith(HISTORY_PREFIX.action)) {
    return { kind: "action", id: value.slice(HISTORY_PREFIX.action.length) as AppAction };
  }
  if (value.startsWith(HISTORY_PREFIX.feed)) {
    return { kind: "feed", id: value.slice(HISTORY_PREFIX.feed.length) };
  }
  if (value.startsWith(HISTORY_PREFIX.tag)) {
    return { kind: "tag", id: value.slice(HISTORY_PREFIX.tag.length) };
  }
  if (value.startsWith(HISTORY_PREFIX.article)) {
    return { kind: "article", id: value.slice(HISTORY_PREFIX.article.length) };
  }
  return null;
}

function getCommandItemValue(kind: HistoryEntry["kind"] | "scenario", id: string): string {
  return `${kind}:${id}`;
}

export function CommandPalette() {
  const { t } = useTranslation("reader");
  const { t: tSidebar } = useTranslation("sidebar");
  const open = useUiStore((state) => state.commandPaletteOpen);
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);
  const showToast = useUiStore((state) => state.showToast);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const selectFeed = useUiStore((state) => state.selectFeed);
  const selectTag = useUiStore((state) => state.selectTag);
  const selectArticle = useUiStore((state) => state.selectArticle);
  const openFeedLanding = useFeedLanding();
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);
  const [input, setInput] = useState("");
  const [devScenarios, setDevScenarios] = useState<RuntimeDevScenario[]>([]);
  const { prefix, query, deferredQuery } = useCommandSearch(input);

  useEffect(() => {
    if (!open) {
      setInput("");
    }
  }, [open]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let cancelled = false;

    void loadRuntimeDevScenarios()
      .then((scenarios) => {
        if (!cancelled) {
          setDevScenarios(scenarios);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDevScenarios([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const actions = useMemo<PaletteAction[]>(
    () => [
      {
        id: "open-settings",
        label: t("shortcuts.open_settings"),
        shortcut: getShortcutDisplay("open_settings", shortcutPrefs, platformKind),
        keywords: ["settings", "preferences"],
        icon: SettingsIcon,
      },
      {
        id: "open-add-feed",
        label: t("add_feed"),
        keywords: ["feed", "rss", "subscribe"],
        icon: RssIcon,
      },
      {
        id: "sync-all",
        label: tSidebar("sync_feeds"),
        keywords: ["sync", "refresh"],
        icon: RefreshCwIcon,
      },
      {
        id: "mark-all-read",
        label: t("shortcuts.mark_all_read"),
        shortcut: getShortcutDisplay("mark_all_read", shortcutPrefs, platformKind),
        keywords: ["read", "articles"],
        icon: NewspaperIcon,
      },
    ],
    [platformKind, shortcutPrefs, t, tSidebar],
  );

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

  function closePalette() {
    closeCommandPalette();
  }

  function handleActionSelect(action: AppAction) {
    addToHistory(`${HISTORY_PREFIX.action}${action}`);
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
    addToHistory(`${HISTORY_PREFIX.feed}${feedId}`);
    void openFeedLanding(feedId);
    closePalette();
  }

  function handleTagSelect(tagId: string) {
    addToHistory(`${HISTORY_PREFIX.tag}${tagId}`);
    selectTag(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    addToHistory(`${HISTORY_PREFIX.article}${articleId}`);
    selectFeed(feedId);
    selectArticle(articleId);
    closePalette();
  }

  function handleDevScenarioSelect(scenarioId: RuntimeDevScenario["id"]) {
    void runRuntimeDevScenario(scenarioId).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to run dev scenario "${scenarioId}": ${message}`);
    });
    closePalette();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closePalette();
        }
      }}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{t("shortcuts.open_command_palette")}</DialogTitle>
        <DialogDescription>{t("command_palette.placeholder")}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput placeholder={t("command_palette.placeholder")} value={input} onValueChange={setInput} />
          <CommandList>
            {showRecentActions && recentActions.length > 0 ? (
              <CommandGroup heading={t("command_palette.recent_actions")}>
                {recentActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={`recent-${action.id}`}
                      value={getCommandItemValue("action", action.id)}
                      onSelect={() => handleActionSelect(action.id)}
                    >
                      <Icon />
                      <span>{action.label}</span>
                      {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {!showRecentActions && showActions && filteredActions.length > 0 ? (
              <CommandGroup heading={t("command_palette.actions")}>
                {filteredActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={action.id}
                      value={getCommandItemValue("action", action.id)}
                      onSelect={() => handleActionSelect(action.id)}
                    >
                      <Icon />
                      <span>{action.label}</span>
                      {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {!showRecentActions && showDevScenarios && filteredDevScenarios.length > 0 ? (
              <CommandGroup heading="Dev Scenarios">
                {filteredDevScenarios.map((scenario) => (
                  <CommandItem
                    key={scenario.id}
                    value={getCommandItemValue("scenario", scenario.id)}
                    onSelect={() => handleDevScenarioSelect(scenario.id)}
                  >
                    <FlaskConicalIcon />
                    <span>{scenario.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!showRecentActions && showFeeds && filteredFeeds.length > 0 ? (
              <CommandGroup heading={t("command_palette.feeds")}>
                {filteredFeeds.map((feed) => (
                  <CommandItem
                    key={feed.id}
                    value={getCommandItemValue("feed", feed.id)}
                    onSelect={() => handleFeedSelect(feed.id)}
                  >
                    <RssIcon />
                    <span>{feed.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!showRecentActions && showTags && filteredTags.length > 0 ? (
              <CommandGroup heading={t("command_palette.tags")}>
                {filteredTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={getCommandItemValue("tag", tag.id)}
                    onSelect={() => handleTagSelect(tag.id)}
                  >
                    <HashIcon />
                    <span>{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!showRecentActions && showArticles && articles.length > 0 ? (
              <CommandGroup heading={t("command_palette.articles")}>
                {articles.map((article) => (
                  <CommandItem
                    key={article.id}
                    value={getCommandItemValue("article", article.id)}
                    onSelect={() => handleArticleSelect(article.feed_id, article.id)}
                  >
                    <NewspaperIcon />
                    <span>{article.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!showRecentActions && !hasVisibleResults ? (
              <CommandEmpty>{t("command_palette.no_results")}</CommandEmpty>
            ) : null}
          </CommandList>
          <CommandSeparator />
          <div className="text-muted-foreground flex items-center gap-4 px-3 py-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="font-mono">&gt;</span>
              <span>{t("command_palette.prefix_hint_actions")}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono">@</span>
              <span>{t("command_palette.prefix_hint_feeds")}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono">#</span>
              <span>{t("command_palette.prefix_hint_tags")}</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
