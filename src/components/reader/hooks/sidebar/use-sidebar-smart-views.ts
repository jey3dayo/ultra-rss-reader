import { useMemo } from "react";
import { buildSidebarSmartViews } from "@/lib/sidebar-smart-views";
import type { SidebarSmartViewsParams, SidebarSmartViewsResult } from "../../sidebar.types";

export function useSidebarSmartViews({
  selection,
  totalUnread,
  starredCount,
  showUnreadCount,
  showStarredCount,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarRecentArticles,
  t,
}: SidebarSmartViewsParams): SidebarSmartViewsResult {
  const selectedSmartViewKind = selection.type === "smart" ? (selection.kind ?? null) : null;

  const smartViews = useMemo<SidebarSmartViewsResult>(
    () =>
      buildSidebarSmartViews({
        selectedSmartViewKind,
        totalUnread,
        starredCount,
        showUnreadCount,
        showStarredCount,
        showSidebarUnread,
        showSidebarStarred,
        showSidebarRecentArticles,
        labels: {
          unread: t("unread"),
          starred: t("starred"),
          recent: t("recent_articles"),
        },
      }),
    [
      selectedSmartViewKind,
      showSidebarRecentArticles,
      showSidebarStarred,
      showSidebarUnread,
      showStarredCount,
      showUnreadCount,
      starredCount,
      t,
      totalUnread,
    ],
  );

  return smartViews;
}
