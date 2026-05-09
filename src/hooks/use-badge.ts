import { useEffect, useMemo, useRef } from "react";
import type { FeedDto } from "@/api/schemas/feed";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";
import { useFeeds } from "@/hooks/use-feeds";
import type { UnreadBadgePreference } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function unreadCountToBadgeCount(count: number | undefined): number | undefined {
  return count && count > 0 ? count : undefined;
}

function resolveUnreadBadgePreference(value: string | undefined): UnreadBadgePreference {
  if (value === "all_unread" || value === "only_inbox" || value === "dont_display") {
    return value;
  }

  return "dont_display";
}

function resolveBadgeCount({
  accountUnreadCount,
  badgePref,
  feeds,
  selectedAccountId,
}: {
  accountUnreadCount: number | undefined;
  badgePref: UnreadBadgePreference;
  feeds: FeedDto[] | undefined;
  selectedAccountId: string | null;
}): number | undefined {
  if (badgePref === "dont_display" || selectedAccountId === null) {
    return undefined;
  }

  if (badgePref === "only_inbox") {
    return unreadCountToBadgeCount(accountUnreadCount);
  }

  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;
  return unreadCountToBadgeCount(totalUnread);
}

async function setBadgeCount(count: number | undefined, isLatestRequest: () => boolean): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = await getCurrentWindow();
    if (!isLatestRequest()) {
      return;
    }
    await currentWindow.setBadgeCount(count);
  } catch {
    // Non-Tauri context (browser dev mode) — no-op
  }
}

export function useBadge() {
  const badgeRequestSeqRef = useRef(0);
  const latestBadgeCountRef = useRef<number | undefined>(undefined);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const badgePref = usePreferencesStore((s) => resolveUnreadBadgePreference(s.prefs.unread_badge));
  const feedAccountId = badgePref === "all_unread" ? selectedAccountId : null;
  const { data: feeds } = useFeeds(feedAccountId);
  const { data: accountUnreadCount } = useAccountUnreadCount(
    selectedAccountId,
    badgePref === "only_inbox" && selectedAccountId !== null,
  );
  const badgeCount = useMemo(
    () =>
      resolveBadgeCount({
        accountUnreadCount,
        badgePref,
        feeds,
        selectedAccountId,
      }),
    [accountUnreadCount, badgePref, feeds, selectedAccountId],
  );

  useEffect(() => {
    badgeRequestSeqRef.current += 1;
    const requestSeq = badgeRequestSeqRef.current;
    latestBadgeCountRef.current = badgeCount;

    void (async () => {
      await setBadgeCount(badgeCount, () => badgeRequestSeqRef.current === requestSeq);

      let appliedRequestSeq = requestSeq;
      while (appliedRequestSeq !== badgeRequestSeqRef.current) {
        const latestRequestSeq = badgeRequestSeqRef.current;
        const latestBadgeCount = latestBadgeCountRef.current;

        await setBadgeCount(latestBadgeCount, () => badgeRequestSeqRef.current === latestRequestSeq);
        appliedRequestSeq = latestRequestSeq;
      }
    })();
  }, [badgeCount]);
}
