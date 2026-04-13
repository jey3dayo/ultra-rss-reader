import { useTranslation } from "react-i18next";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import type { CommandPaletteControllerResult } from "./command-palette.types";
import { useCommandPaletteActions } from "./use-command-palette-actions";
import { useCommandPaletteData } from "./use-command-palette-data";
import { useCommandPaletteHandlers } from "./use-command-palette-handlers";
import { useCommandPaletteRuntime } from "./use-command-palette-runtime";
import { useCommandPaletteUiState } from "./use-command-palette-ui-state";
import { useCommandPaletteViewProps } from "./use-command-palette-view-props";

export function useCommandPaletteController(): CommandPaletteControllerResult {
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
  const { input, setInput, devScenarios, prefix, query, deferredQuery } = useCommandPaletteRuntime(open);
  const actions = useCommandPaletteActions({ platformKind, shortcutPrefs });
  const closePalette = () => {
    closeCommandPalette();
  };
  const { handleActionSelect, handleFeedSelect, handleTagSelect, handleArticleSelect, handleDevScenarioSelect } =
    useCommandPaletteHandlers({
      closePalette,
      openShortcutsHelp,
      showToast,
      selectFeed,
      selectTag,
      selectArticle,
      openFeedLanding,
    });

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
