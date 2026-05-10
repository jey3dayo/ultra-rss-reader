import { useArticleListHeaderActions } from "@/components/reader/hooks/article-list/use-article-list-header-actions";
import { useArticleListHeaderControls } from "@/components/reader/hooks/article-list/use-article-list-header-controls";
import type { FeedDisplayPresetOption } from "@/lib/articles/article-display";
import type {
  UseArticleListHeaderControllerParams,
  UseArticleListHeaderControllerResult,
} from "./article-list-controller.types";

export function useArticleListHeaderController({
  selection,
  feeds,
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
      selection,
      feeds,
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
