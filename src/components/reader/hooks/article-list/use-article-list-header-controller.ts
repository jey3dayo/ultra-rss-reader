import { useArticleListHeaderActions } from "@/components/reader/hooks/article-list/use-article-list-header-actions";
import { useArticleListHeaderControls } from "@/components/reader/hooks/article-list/use-article-list-header-controls";
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
  showSearch,
  contentMode,
  sidebarSubscriptionsLabel,
  showSidebarLabel,
  hideSidebarLabel,
  openSidebar,
  toggleSidebar,
  setWebPreviewSessionMode,
}: UseArticleListHeaderControllerParams): UseArticleListHeaderControllerResult {
  const { handleMarkAllRead } = useArticleListHeaderActions({
    selection,
    feeds,
    feedId,
    selectedFeed,
    filteredArticles,
  });

  const headerControls = useArticleListHeaderControls({
    layoutMode,
    sidebarOpen,
    showSearch,
    contentMode,
    sidebarSubscriptionsLabel,
    showSidebarLabel,
    hideSidebarLabel,
    openSidebar,
    toggleSidebar,
    setWebPreviewSessionMode,
  });

  return {
    ...headerControls,
    handleMarkAllRead,
  };
}
