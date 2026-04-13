import { useCallback, useMemo } from "react";
import type { UseArticleListHeaderControlsParams } from "./article-list.types";
import { ArticleListFeedModeControl } from "./article-list-feed-mode-control";

export type UseArticleListHeaderControlsResult = {
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  feedModeControl: React.ReactNode;
  handleSidebarToggle: () => void;
};

export function useArticleListHeaderControls({
  layoutMode,
  sidebarOpen,
  sidebarSubscriptionsLabel,
  feedDisplayLabel,
  showSidebarLabel,
  hideSidebarLabel,
  resolvedFeedId,
  selectedFeedDisplayPreset,
  displayPresetOptions,
  onSetDisplayMode,
  openSidebar,
  toggleSidebar,
}: UseArticleListHeaderControlsParams): UseArticleListHeaderControlsResult {
  const handleSidebarToggle = useCallback(() => {
    if (layoutMode === "wide") {
      toggleSidebar();
      return;
    }

    openSidebar();
  }, [layoutMode, openSidebar, toggleSidebar]);

  const feedModeControl = useMemo(
    () =>
      resolvedFeedId ? (
        <ArticleListFeedModeControl
          ariaLabel={feedDisplayLabel}
          value={selectedFeedDisplayPreset}
          options={displayPresetOptions}
          onValueChange={onSetDisplayMode}
        />
      ) : null,
    [displayPresetOptions, feedDisplayLabel, onSetDisplayMode, resolvedFeedId, selectedFeedDisplayPreset],
  );

  return {
    showSidebarButton: layoutMode === "mobile" || layoutMode === "wide" || layoutMode === "compact",
    sidebarButtonLabel: layoutMode === "wide" ? (sidebarOpen ? hideSidebarLabel : showSidebarLabel) : showSidebarLabel,
    sidebarButtonText: layoutMode === "compact" ? sidebarSubscriptionsLabel : undefined,
    isSidebarVisible: layoutMode === "wide" ? sidebarOpen : undefined,
    feedModeControl,
    handleSidebarToggle,
  };
}
