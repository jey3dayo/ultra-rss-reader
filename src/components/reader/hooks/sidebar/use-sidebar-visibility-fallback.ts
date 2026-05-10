import { useEffect } from "react";
import type { SidebarVisibilityFallbackParams } from "../../sidebar-feed-section.types";

type SidebarVisibilityFallbackDecisionParams = Pick<
  SidebarVisibilityFallbackParams,
  | "firstFeedId"
  | "selection"
  | "tags"
  | "viewMode"
  | "showSidebarUnread"
  | "showSidebarStarred"
  | "showSidebarRecentArticles"
  | "showSidebarTags"
> & {
  feedsReady?: boolean;
};

type SidebarVisibilityFallbackDecision =
  | { type: "none" }
  | { type: "select-all" }
  | { type: "select-feed"; feedId: string }
  | { type: "select-smart-view"; kind: "unread" }
  | { type: "set-view-mode"; mode: "all" };

function resolveFeedOrAllFallback(params: {
  firstFeedId: string | null;
  feedsReady?: boolean;
}): SidebarVisibilityFallbackDecision {
  if (params.firstFeedId) {
    return { type: "select-feed", feedId: params.firstFeedId };
  }

  return params.feedsReady === false ? { type: "none" } : { type: "select-all" };
}

export function resolveSidebarVisibilityFallback({
  firstFeedId,
  feedsReady,
  selection,
  tags,
  viewMode,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarRecentArticles,
  showSidebarTags,
}: SidebarVisibilityFallbackDecisionParams): SidebarVisibilityFallbackDecision {
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
    return showSidebarUnread
      ? { type: "select-smart-view", kind: "unread" }
      : resolveFeedOrAllFallback({ firstFeedId, feedsReady });
  }

  if (hasFilterOnlyUnread && !showSidebarUnread) {
    return { type: "set-view-mode", mode: "all" };
  }

  if (hasSmartUnreadSelection && !showSidebarUnread) {
    return resolveFeedOrAllFallback({ firstFeedId, feedsReady });
  }

  return { type: "none" };
}

export function useSidebarVisibilityFallback({
  firstFeedId,
  feedsReady,
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
}: SidebarVisibilityFallbackParams & { feedsReady?: boolean }) {
  useEffect(() => {
    const decision = resolveSidebarVisibilityFallback({
      firstFeedId,
      feedsReady,
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
    feedsReady,
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
