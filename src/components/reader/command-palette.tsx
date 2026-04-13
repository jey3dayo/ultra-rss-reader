import { CircleHelpIcon, NewspaperIcon, RefreshCwIcon, RssIcon, SettingsIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addToHistory } from "@/hooks/use-command-history";
import { useCommandSearch } from "@/hooks/use-command-search";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { executeAction } from "@/lib/actions";
import { loadRuntimeDevScenarios, type RuntimeDevScenario, runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { getShortcutDisplay } from "@/lib/keyboard-shortcuts";
import { Command, CommandInput, CommandSeparator } from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { CommandPaletteResults } from "./command-palette-results";
import { COMMAND_PALETTE_HISTORY_PREFIX, type PaletteAction, useCommandPaletteData } from "./use-command-palette-data";
import { useCommandPaletteUiState } from "./use-command-palette-ui-state";

function getCommandItemValue(kind: "action" | "feed" | "tag" | "article" | "scenario", id: string): string {
  return `${kind}:${id}`;
}

export function CommandPalette() {
  const { t } = useTranslation("reader");
  const { t: tSidebar } = useTranslation("sidebar");
  const {
    open,
    closeCommandPalette,
    openShortcutsHelp,
    showToast,
    selectedAccountId,
    selectFeed,
    selectTag,
    selectArticle,
    platformKind,
    shortcutPrefs,
  } = useCommandPaletteUiState();
  const openFeedLanding = useFeedLanding();
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
        id: "open-shortcuts-help",
        label: t("shortcuts.open_shortcuts_help"),
        shortcut: "?",
        keywords: ["help", "shortcuts", "keyboard", "?"],
        icon: CircleHelpIcon,
      },
      {
        id: "open-add-feed",
        label: t("add_feed"),
        keywords: ["feed", "rss", "subscribe"],
        icon: RssIcon,
      },
      {
        id: "open-feed-cleanup",
        label: tSidebar("feed_cleanup"),
        keywords: ["feed", "cleanup", "management"],
        icon: RssIcon,
      },
      {
        id: "sync-all",
        label: tSidebar("sync_feeds"),
        keywords: ["sync", "refresh", "reload"],
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

  const {
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
  } = useCommandPaletteData({
    actions,
    deferredQuery,
    devScenarios,
    prefix,
    query,
    selectedAccountId,
  });

  function closePalette() {
    closeCommandPalette();
  }

  function handleActionSelect(action: PaletteAction["id"]) {
    if (action === "open-shortcuts-help") {
      openShortcutsHelp();
      closePalette();
      return;
    }
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.action}${action}`);
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.feed}${feedId}`);
    void openFeedLanding(feedId);
    closePalette();
  }

  function handleTagSelect(tagId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.tag}${tagId}`);
    selectTag(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.article}${articleId}`);
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
          <CommandPaletteResults
            recentActions={recentActions}
            filteredActions={filteredActions}
            filteredDevScenarios={filteredDevScenarios}
            filteredFeeds={filteredFeeds}
            filteredTags={filteredTags}
            articles={articles}
            showRecentActions={showRecentActions}
            showActions={showActions}
            showDevScenarios={showDevScenarios}
            showFeeds={showFeeds}
            showTags={showTags}
            showArticles={showArticles}
            hasVisibleResults={hasVisibleResults}
            noResultsLabel={t("command_palette.no_results")}
            recentActionsHeading={t("command_palette.recent_actions")}
            actionsHeading={t("command_palette.actions")}
            feedsHeading={t("command_palette.feeds")}
            tagsHeading={t("command_palette.tags")}
            articlesHeading={t("command_palette.articles")}
            getCommandItemValue={getCommandItemValue}
            onActionSelect={handleActionSelect}
            onDevScenarioSelect={handleDevScenarioSelect}
            onFeedSelect={handleFeedSelect}
            onTagSelect={handleTagSelect}
            onArticleSelect={handleArticleSelect}
          />
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
