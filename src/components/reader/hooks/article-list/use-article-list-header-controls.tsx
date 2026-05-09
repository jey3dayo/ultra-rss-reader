import { useCallback, useMemo } from "react";
import type { UseArticleListHeaderControlsParams, UseArticleListHeaderControlsResult } from "../../article-list.types";
import { ArticleListFeedModeControl } from "../../article-list-feed-mode-control";

export type ArticleListHeaderControlAvailabilityInput = {
  layoutMode: UseArticleListHeaderControlsParams["layoutMode"];
  sidebarOpen: boolean;
  resolvedFeedId: string | null;
  showSearch: boolean;
};

export type ArticleListHeaderControlAvailability = {
  showSidebarButton: boolean;
  isSidebarTogglePressed: boolean | undefined;
  showFeedDisplaySelect: boolean;
  showMarkAllRead: boolean;
  showSearchToggle: boolean;
  showCloseSearch: boolean;
};

export function resolveArticleListHeaderControlAvailability({
  layoutMode,
  sidebarOpen,
  resolvedFeedId,
  showSearch,
}: ArticleListHeaderControlAvailabilityInput): ArticleListHeaderControlAvailability {
  const hasResolvedFeedId = resolvedFeedId !== null && resolvedFeedId.trim().length > 0;

  return {
    showSidebarButton: layoutMode === "mobile" || layoutMode === "wide" || layoutMode === "compact",
    isSidebarTogglePressed: layoutMode === "wide" ? sidebarOpen : undefined,
    showFeedDisplaySelect: hasResolvedFeedId,
    showMarkAllRead: true,
    showSearchToggle: true,
    showCloseSearch: showSearch,
  };
}

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
  const availability = resolveArticleListHeaderControlAvailability({
    layoutMode,
    sidebarOpen,
    resolvedFeedId,
    showSearch: false,
  });
  const handleSidebarToggle = useCallback(() => {
    if (layoutMode === "wide") {
      toggleSidebar();
      return;
    }

    openSidebar();
  }, [layoutMode, openSidebar, toggleSidebar]);

  const feedModeControl = useMemo(
    () =>
      availability.showFeedDisplaySelect ? (
        <ArticleListFeedModeControl
          ariaLabel={feedDisplayLabel}
          value={selectedFeedDisplayPreset}
          options={displayPresetOptions}
          onValueChange={onSetDisplayMode}
        />
      ) : null,
    [
      availability.showFeedDisplaySelect,
      displayPresetOptions,
      feedDisplayLabel,
      onSetDisplayMode,
      selectedFeedDisplayPreset,
    ],
  );

  return {
    showSidebarButton: availability.showSidebarButton,
    sidebarButtonLabel: layoutMode === "wide" ? (sidebarOpen ? hideSidebarLabel : showSidebarLabel) : showSidebarLabel,
    sidebarButtonText: layoutMode === "compact" ? sidebarSubscriptionsLabel : undefined,
    isSidebarVisible: availability.isSidebarTogglePressed,
    feedModeControl,
    handleSidebarToggle,
  };
}
