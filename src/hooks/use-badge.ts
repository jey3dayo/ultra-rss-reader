import { useEffect } from "react";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";
import { useFeeds } from "@/hooks/use-feeds";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

async function setBadgeCount(count: number | undefined): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setBadgeCount(count);
  } catch {
    // Non-Tauri context (browser dev mode) — no-op
  }
}

export function useBadge() {
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const badgePref = usePreferencesStore((s) => s.prefs.unread_badge ?? "dont_display");
  const { data: accountUnreadCount } = useAccountUnreadCount(
    selectedAccountId,
    badgePref === "only_inbox" && selectedAccountId !== null,
  );

  useEffect(() => {
    if (badgePref === "dont_display" || selectedAccountId === null) {
      setBadgeCount(undefined);
      return;
    }

    if (badgePref === "only_inbox") {
      setBadgeCount(accountUnreadCount && accountUnreadCount > 0 ? accountUnreadCount : undefined);
      return;
    }

    const totalUnread = feeds?.reduce((sum, f) => sum + f.unread_count, 0) ?? 0;
    setBadgeCount(totalUnread > 0 ? totalUnread : undefined);
  }, [accountUnreadCount, badgePref, feeds, selectedAccountId]);
}
