import { useMemo } from "react";
import type { SidebarSmartViewsParams, SidebarSmartViewsResult } from "./sidebar.types";

export function useSidebarSmartViews({
  selection,
  totalUnread,
  starredCount,
  showUnreadCount,
  showStarredCount,
  showSidebarUnread,
  showSidebarStarred,
  t,
}: SidebarSmartViewsParams): SidebarSmartViewsResult {
  const selectedSmartViewKind = selection.type === "smart" ? (selection.kind ?? null) : null;

  const smartViews = useMemo<SidebarSmartViewsResult>(
    () => [
      {
        kind: "unread",
        label: t("unread"),
        count: totalUnread,
        showCount: showUnreadCount,
        isSelected: selectedSmartViewKind === "unread",
      },
      {
        kind: "starred",
        label: t("starred"),
        count: starredCount,
        showCount: showStarredCount && starredCount > 0,
        isSelected: selectedSmartViewKind === "starred",
      },
    ],
    [selectedSmartViewKind, showStarredCount, showUnreadCount, starredCount, t, totalUnread],
  );

  return useMemo(
    () =>
      smartViews.filter((view) => {
        if (view.kind === "unread") {
          return showSidebarUnread;
        }
        if (view.kind === "starred") {
          return showSidebarStarred;
        }
        return true;
      }),
    [showSidebarStarred, showSidebarUnread, smartViews],
  );
}
