import type { FeedDisplayPresetOption } from "@/lib/article-display";
import type { UseArticleListHeaderControllerParams, UseArticleListHeaderControllerResult } from "./article-list.types";
import { useArticleListHeaderActions } from "./use-article-list-header-actions";
import { useArticleListHeaderControls } from "./use-article-list-header-controls";

export function useArticleListHeaderController({
  feedId,
  selectedFeed,
  filteredArticles,
  layoutMode,
  sidebarOpen,
  sidebarSubscriptionsLabel,
  feedDisplayLabel,
  showSidebarLabel,
  hideSidebarLabel,
  openSidebar,
  toggleSidebar,
}: UseArticleListHeaderControllerParams): UseArticleListHeaderControllerResult {
  const { selectedFeedDisplayPreset, displayPresetOptions, handleSetDisplayMode, handleMarkAllRead } =
    useArticleListHeaderActions({
      feedId,
      selectedFeed,
      filteredArticles,
    });

  const headerControls = useArticleListHeaderControls({
    layoutMode,
    sidebarOpen,
    sidebarSubscriptionsLabel,
    feedDisplayLabel,
    showSidebarLabel,
    hideSidebarLabel,
    resolvedFeedId: feedId,
    selectedFeedDisplayPreset,
    displayPresetOptions,
    onSetDisplayMode: (value: FeedDisplayPresetOption) => {
      void handleSetDisplayMode(value);
    },
    openSidebar,
    toggleSidebar,
  });

  return {
    ...headerControls,
    handleMarkAllRead,
  };
}
