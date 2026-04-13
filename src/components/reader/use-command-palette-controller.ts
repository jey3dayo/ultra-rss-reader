import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addToHistory } from "@/hooks/use-command-history";
import { useCommandSearch } from "@/hooks/use-command-search";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { executeAction } from "@/lib/actions";
import { loadRuntimeDevScenarios, type RuntimeDevScenario, runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { useCommandPaletteActions } from "./use-command-palette-actions";
import { COMMAND_PALETTE_HISTORY_PREFIX, type PaletteAction, useCommandPaletteData } from "./use-command-palette-data";
import { useCommandPaletteUiState } from "./use-command-palette-ui-state";
import { useCommandPaletteViewProps } from "./use-command-palette-view-props";

export function useCommandPaletteController() {
  const { t } = useTranslation("reader");
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
  const actions = useCommandPaletteActions({ platformKind, shortcutPrefs });

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

  return {
    open,
    input,
    setInput,
    closePalette,
    ...useCommandPaletteViewProps({
      title: t("shortcuts.open_command_palette"),
      description: t("command_palette.placeholder"),
      placeholder: t("command_palette.placeholder"),
      noResultsLabel: t("command_palette.no_results"),
      recentActionsHeading: t("command_palette.recent_actions"),
      actionsHeading: t("command_palette.actions"),
      feedsHeading: t("command_palette.feeds"),
      tagsHeading: t("command_palette.tags"),
      articlesHeading: t("command_palette.articles"),
      recentActions,
      filteredActions,
      filteredDevScenarios,
      filteredFeeds,
      filteredTags,
      articles,
      showRecentActions,
      showActions,
      showDevScenarios,
      showFeeds,
      showTags,
      showArticles,
      hasVisibleResults,
      onActionSelect: handleActionSelect,
      onDevScenarioSelect: handleDevScenarioSelect,
      onFeedSelect: handleFeedSelect,
      onTagSelect: handleTagSelect,
      onArticleSelect: handleArticleSelect,
      prefixHintActions: t("command_palette.prefix_hint_actions"),
      prefixHintFeeds: t("command_palette.prefix_hint_feeds"),
      prefixHintTags: t("command_palette.prefix_hint_tags"),
    }),
  };
}
