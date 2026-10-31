const SIDEBAR_UNREAD_COUNT_DISPLAY_MAX = 9_999;

export type SidebarUnreadCountPresentation = {
  label: string;
  /** Exact count for tooltip when the visible label is capped. */
  title?: string;
};

export function formatSidebarUnreadCount(count: number): SidebarUnreadCountPresentation {
  if (count <= SIDEBAR_UNREAD_COUNT_DISPLAY_MAX) {
    return { label: count.toLocaleString() };
  }

  return {
    label: `${SIDEBAR_UNREAD_COUNT_DISPLAY_MAX.toLocaleString()}+`,
    title: count.toLocaleString(),
  };
}
