import { useCallback, useMemo } from "react";
import { ArticleListFeedModeControl } from "../../article-list-feed-mode-control";
import type {
  UseArticleListHeaderControlsParams,
  UseArticleListHeaderControlsResult,
} from "./article-list-controller.types";

export type ArticleListHeaderControlAvailabilityInput = {
  layoutMode: UseArticleListHeaderControlsParams["layoutMode"];
  sidebarOpen: boolean;
  contentMode: UseArticleListHeaderControlsParams["contentMode"];
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

function hasConcreteResolvedFeedId(resolvedFeedId: string | null): boolean {
  return resolvedFeedId !== null && resolvedFeedId.trim().length > 0;
}

export function resolveArticleListHeaderControlAvailability({
  layoutMode,
  sidebarOpen,
  contentMode,
  resolvedFeedId,
  showSearch,
}: ArticleListHeaderControlAvailabilityInput): ArticleListHeaderControlAvailability {
  const hasResolvedFeedId = hasConcreteResolvedFeedId(resolvedFeedId);
  const isWideBrowserMode = layoutMode === "wide" && contentMode === "browser";

  return {
    showSidebarButton: layoutMode === "mobile" || layoutMode === "wide" || layoutMode === "compact",
    isSidebarTogglePressed: layoutMode === "wide" ? (isWideBrowserMode ? false : sidebarOpen) : undefined,
    showFeedDisplaySelect: hasResolvedFeedId && !showSearch,
    showMarkAllRead: true,
    showSearchToggle: true,
    showCloseSearch: showSearch,
  };
}

export function useArticleListHeaderControls({
  layoutMode,
  sidebarOpen,
  showSearch,
  contentMode,
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
  setWebPreviewSessionMode,
}: UseArticleListHeaderControlsParams): UseArticleListHeaderControlsResult {
  const availability = resolveArticleListHeaderControlAvailability({
    layoutMode,
    sidebarOpen,
    contentMode,
    resolvedFeedId,
    showSearch,
  });
  const handleSidebarToggle = useCallback(() => {
    if (layoutMode === "wide" && contentMode === "browser") {
      setWebPreviewSessionMode("forced-off");
      return;
    }

    if (layoutMode === "wide") {
      toggleSidebar();
      return;
    }

    openSidebar();
  }, [contentMode, layoutMode, openSidebar, setWebPreviewSessionMode, toggleSidebar]);

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
    sidebarButtonLabel:
      layoutMode === "wide" && contentMode !== "browser"
        ? sidebarOpen
          ? hideSidebarLabel
          : showSidebarLabel
        : showSidebarLabel,
    sidebarButtonText: layoutMode === "compact" ? sidebarSubscriptionsLabel : undefined,
    isSidebarVisible: availability.isSidebarTogglePressed,
    feedModeControl,
    handleSidebarToggle,
  };
}
