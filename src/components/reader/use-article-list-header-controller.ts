import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { FeedDisplayPresetOption } from "@/lib/article-display";
import { type UseArticleListHeaderActionsResult, useArticleListHeaderActions } from "./use-article-list-header-actions";
import {
  type UseArticleListHeaderControlsResult,
  useArticleListHeaderControls,
} from "./use-article-list-header-controls";

export type UseArticleListHeaderControllerParams = {
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
  layoutMode: "wide" | "compact" | "mobile";
  sidebarOpen: boolean;
  sidebarSubscriptionsLabel: string;
  feedDisplayLabel: string;
  showSidebarLabel: string;
  hideSidebarLabel: string;
  openSidebar: () => void;
  toggleSidebar: () => void;
};

export type UseArticleListHeaderControllerResult = UseArticleListHeaderControlsResult &
  Pick<UseArticleListHeaderActionsResult, "handleMarkAllRead">;

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
