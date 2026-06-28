import { useCallback } from "react";
import type {
  UseArticleListHeaderControlsParams,
  UseArticleListHeaderControlsResult,
} from "./article-list-controller.types";

export type ArticleListHeaderControlAvailabilityInput = {
  layoutMode: UseArticleListHeaderControlsParams["layoutMode"];
  sidebarOpen: boolean;
  contentMode: UseArticleListHeaderControlsParams["contentMode"];
  showSearch: boolean;
};

export type ArticleListHeaderControlAvailability = {
  showSidebarButton: boolean;
  isSidebarTogglePressed: boolean | undefined;
  showMarkAllRead: boolean;
  showSearchToggle: boolean;
  showCloseSearch: boolean;
};

export function resolveArticleListHeaderControlAvailability({
  layoutMode,
  sidebarOpen,
  contentMode,
  showSearch,
}: ArticleListHeaderControlAvailabilityInput): ArticleListHeaderControlAvailability {
  const isWideBrowserMode = layoutMode === "wide" && contentMode === "browser";

  return {
    showSidebarButton: layoutMode === "mobile" || layoutMode === "wide" || layoutMode === "compact",
    isSidebarTogglePressed: layoutMode === "wide" ? (isWideBrowserMode ? false : sidebarOpen) : undefined,
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
  showSidebarLabel,
  hideSidebarLabel,
  openSidebar,
  toggleSidebar,
  setWebPreviewSessionMode,
}: UseArticleListHeaderControlsParams): UseArticleListHeaderControlsResult {
  const availability = resolveArticleListHeaderControlAvailability({
    layoutMode,
    sidebarOpen,
    contentMode,
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
    handleSidebarToggle,
  };
}
