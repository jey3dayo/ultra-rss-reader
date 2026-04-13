import { useMemo } from "react";
import type { SmartViewItemViewModel } from "./smart-views-view";

type UseSidebarSmartViewsParams = {
  selection: { type: string; kind?: "unread" | "starred" };
  totalUnread: number;
  starredCount: number;
  showUnreadCount: boolean;
  showStarredCount: boolean;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  t: (key: string) => string;
};

export function useSidebarSmartViews({
  selection,
  totalUnread,
  starredCount,
  showUnreadCount,
  showStarredCount,
  showSidebarUnread,
  showSidebarStarred,
  t,
}: UseSidebarSmartViewsParams) {
  const selectedSmartViewKind = selection.type === "smart" ? (selection.kind ?? null) : null;

  const smartViews = useMemo<SmartViewItemViewModel[]>(
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
