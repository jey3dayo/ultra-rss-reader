import { useEffect } from "react";
import type { SidebarVisibilityFallbackParams } from "./sidebar-feed-section.types";

export function useSidebarVisibilityFallback({
  firstFeedId,
  selection,
  viewMode,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarTags,
  selectFeed,
  selectAll,
  selectSmartView,
  setViewMode,
}: SidebarVisibilityFallbackParams) {
  const selectedSmartViewKind = selection.type === "smart" ? selection.kind : null;
  const hasSmartUnreadSelection = selectedSmartViewKind === "unread";
  const hasSmartStarredSelection = selectedSmartViewKind === "starred";
  const hasFilterOnlyUnread = viewMode === "unread" && !hasSmartUnreadSelection;
  const hasFilterOnlyStarred = viewMode === "starred" && !hasSmartStarredSelection;

  useEffect(() => {
    const fallbackToFeedOrAll = () => {
      if (firstFeedId) {
        selectFeed(firstFeedId);
        return;
      }

      selectAll();
    };

    if (hasFilterOnlyStarred && !showSidebarStarred) {
      setViewMode("all");
      return;
    }

    if (hasSmartStarredSelection && !showSidebarStarred) {
      if (showSidebarUnread) {
        selectSmartView("unread");
      } else {
        fallbackToFeedOrAll();
      }
      return;
    }

    if (selection.type === "tag" && !showSidebarTags) {
      if (showSidebarUnread) {
        selectSmartView("unread");
      } else {
        fallbackToFeedOrAll();
      }
      return;
    }

    if (hasFilterOnlyUnread && !showSidebarUnread) {
      setViewMode("all");
      return;
    }

    if (hasSmartUnreadSelection && !showSidebarUnread) {
      fallbackToFeedOrAll();
    }
  }, [
    firstFeedId,
    hasFilterOnlyStarred,
    hasFilterOnlyUnread,
    hasSmartStarredSelection,
    hasSmartUnreadSelection,
    selectAll,
    selectFeed,
    selectSmartView,
    selection,
    setViewMode,
    showSidebarStarred,
    showSidebarTags,
    showSidebarUnread,
  ]);
}
