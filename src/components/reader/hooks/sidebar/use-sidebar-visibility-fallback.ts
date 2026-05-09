import { useEffect } from "react";
import type { SidebarVisibilityFallbackParams } from "../../sidebar-feed-section.types";

type SidebarVisibilityFallbackDecision =
  | { type: "none" }
  | { type: "select-all" }
  | { type: "select-feed"; feedId: string }
  | { type: "select-smart-view"; kind: "unread" }
  | { type: "set-view-mode"; mode: "all" };

function resolveFeedOrAllFallback(firstFeedId: string | null): SidebarVisibilityFallbackDecision {
  return firstFeedId ? { type: "select-feed", feedId: firstFeedId } : { type: "select-all" };
}

export function resolveSidebarVisibilityFallback({
  firstFeedId,
  selection,
  tags,
  viewMode,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarRecentArticles,
  showSidebarTags,
}: Pick<
  SidebarVisibilityFallbackParams,
  | "firstFeedId"
  | "selection"
  | "tags"
  | "viewMode"
  | "showSidebarUnread"
  | "showSidebarStarred"
  | "showSidebarRecentArticles"
  | "showSidebarTags"
>): SidebarVisibilityFallbackDecision {
  const selectedSmartViewKind = selection.type === "smart" ? selection.kind : null;
  const hasSmartUnreadSelection = selectedSmartViewKind === "unread";
  const hasSmartStarredSelection = selectedSmartViewKind === "starred";
  const hasSmartRecentSelection = selectedSmartViewKind === "recent";
  const hasFilterOnlyUnread = viewMode === "unread" && !hasSmartUnreadSelection;
  const hasFilterOnlyStarred = viewMode === "starred" && !hasSmartStarredSelection;
  const isMissingSelectedTag =
    selection.type === "tag" && tags !== undefined && !tags.some((tag) => tag.id === selection.tagId);

  if (hasFilterOnlyStarred && !showSidebarStarred) {
    return { type: "set-view-mode", mode: "all" };
  }

  if (
    (hasSmartStarredSelection && !showSidebarStarred) ||
    (hasSmartRecentSelection && !showSidebarRecentArticles) ||
    (selection.type === "tag" && !showSidebarTags) ||
    isMissingSelectedTag
  ) {
    return showSidebarUnread ? { type: "select-smart-view", kind: "unread" } : resolveFeedOrAllFallback(firstFeedId);
  }

  if (hasFilterOnlyUnread && !showSidebarUnread) {
    return { type: "set-view-mode", mode: "all" };
  }

  if (hasSmartUnreadSelection && !showSidebarUnread) {
    return resolveFeedOrAllFallback(firstFeedId);
  }

  return { type: "none" };
}

export function useSidebarVisibilityFallback({
  firstFeedId,
  selection,
  tags,
  viewMode,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarRecentArticles,
  showSidebarTags,
  selectFeed,
  selectAll,
  selectSmartView,
  setViewMode,
}: SidebarVisibilityFallbackParams) {
  useEffect(() => {
    const decision = resolveSidebarVisibilityFallback({
      firstFeedId,
      selection,
      tags,
      viewMode,
      showSidebarUnread,
      showSidebarStarred,
      showSidebarRecentArticles,
      showSidebarTags,
    });

    switch (decision.type) {
      case "select-all":
        selectAll();
        return;
      case "select-feed":
        selectFeed(decision.feedId);
        return;
      case "select-smart-view":
        selectSmartView(decision.kind);
        return;
      case "set-view-mode":
        setViewMode(decision.mode);
        return;
      case "none":
        return;
    }
  }, [
    firstFeedId,
    selectAll,
    selectFeed,
    selectSmartView,
    selection,
    setViewMode,
    showSidebarStarred,
    showSidebarRecentArticles,
    showSidebarTags,
    showSidebarUnread,
    tags,
    viewMode,
  ]);
}
