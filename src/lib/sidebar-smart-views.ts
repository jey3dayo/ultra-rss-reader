import type { SmartViewItemViewModel, SmartViewKind } from "@/components/reader/sidebar.types";

export type BuildSidebarSmartViewsParams = {
  selectedSmartViewKind: SmartViewKind | null;
  totalUnread: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarRecentArticles: boolean;
  labels: Record<SmartViewKind, string>;
};

export function buildSidebarSmartViews({
  selectedSmartViewKind,
  totalUnread,
  starredCount,
  showUnreadCount,
  showStarredCount,
  showSidebarUnread,
  showSidebarStarred,
  showSidebarRecentArticles,
  labels,
}: BuildSidebarSmartViewsParams): SmartViewItemViewModel[] {
  const smartViews: SmartViewItemViewModel[] = [
    {
      kind: "unread",
      label: labels.unread,
      count: totalUnread,
      showCount: showUnreadCount,
      isSelected: selectedSmartViewKind === "unread",
    },
    {
      kind: "starred",
      label: labels.starred,
      count: starredCount,
      showCount: showStarredCount && starredCount > 0,
      isSelected: selectedSmartViewKind === "starred",
    },
    {
      kind: "recent",
      label: labels.recent,
      count: 0,
      showCount: false,
      isSelected: selectedSmartViewKind === "recent",
    },
  ];

  return smartViews.filter((view) => {
    if (view.kind === "unread") {
      return showSidebarUnread;
    }
    if (view.kind === "starred") {
      return showSidebarStarred;
    }
    if (view.kind === "recent") {
      return showSidebarRecentArticles;
    }
    return true;
  });
}
