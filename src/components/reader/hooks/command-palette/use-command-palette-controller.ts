import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCommandPaletteActions } from "@/components/reader/hooks/command-palette/use-command-palette-actions";
import { useCommandPaletteData } from "@/components/reader/hooks/command-palette/use-command-palette-data";
import { useCommandPaletteHandlers } from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import { useCommandPaletteRuntime } from "@/components/reader/hooks/command-palette/use-command-palette-runtime";
import { useCommandPaletteUiState } from "@/components/reader/hooks/command-palette/use-command-palette-ui-state";
import { useCommandPaletteViewProps } from "@/components/reader/hooks/command-palette/use-command-palette-view-props";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import type { CommandPaletteControllerResult } from "../../command-palette.types";

export function useCommandPaletteController(): CommandPaletteControllerResult {
  const { t } = useTranslation("reader");
  const {
    open,
    closeCommandPalette,
    openShortcutsHelp,
    showToast,
    selectedAccountId,
    selectFeedFromCurrentContext,
    selectTagFromCurrentContext,
    selectArticle,
    platformKind,
    shortcutPrefs,
    isSyncing,
  } = useCommandPaletteUiState();
  const openFeedLanding = useFeedLanding();
  const selectedAccountIdRef = useRef(selectedAccountId);
  const paletteSessionIdRef = useRef(0);
  const wasOpenRef = useRef(open);
  if (open && !wasOpenRef.current) {
    paletteSessionIdRef.current += 1;
  }
  wasOpenRef.current = open;
  const { input, setInput, devScenarios, prefix, query, deferredQuery } = useCommandPaletteRuntime({ open });
  const actions = useCommandPaletteActions({
    platformKind,
    shortcutPrefs,
    selectedAccountId,
    isSyncing,
  });
  const closePalette = () => {
    closeCommandPalette();
  };

  useEffect(() => {
    if (selectedAccountIdRef.current === selectedAccountId) {
      return;
    }

    selectedAccountIdRef.current = selectedAccountId;
    if (open) {
      closeCommandPalette();
    }
  }, [closeCommandPalette, open, selectedAccountId]);

  const {
    articles,
    filteredActions,
    filteredDevScenarios,
    filteredFeeds,
    filteredTags,
    recentFeeds,
    recentTags,
    recentArticles,
    recentActions,
    selectableArticleFeedIds,
    selectableArticleIds,
    showRecentActions,
    showRecentResources,
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
  const { handleActionSelect, handleFeedSelect, handleTagSelect, handleArticleSelect, handleDevScenarioSelect } =
    useCommandPaletteHandlers({
      closePalette,
      openShortcutsHelp,
      showToast,
      selectedAccountId,
      isSyncing,
      selectFeedFromCurrentContext,
      selectTagFromCurrentContext,
      selectArticle,
      openFeedLanding,
      paletteSessionId: paletteSessionIdRef.current,
      canSelectArticle: (feedId, articleId) =>
        selectableArticleFeedIds.has(feedId) && selectableArticleIds.has(articleId),
    });

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
      devScenariosHeading: t("command_palette.dev_scenarios"),
      feedsHeading: t("command_palette.feeds"),
      tagsHeading: t("command_palette.tags"),
      articlesHeading: t("command_palette.articles"),
      recentActions,
      filteredActions,
      filteredDevScenarios,
      filteredFeeds,
      filteredTags,
      articles,
      recentFeeds,
      recentTags,
      recentArticles,
      showRecentActions,
      showRecentResources,
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
