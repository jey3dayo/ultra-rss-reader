import { useEffect, useMemo, useRef } from "react";
import type { FeedDto } from "@/api/schemas/feed";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";
import { useFeeds } from "@/hooks/use-feeds";
import type { UnreadBadgePreference } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function unreadCountToBadgeCount(
  count: number | undefined,
): number | undefined {
  return count !== undefined && Number.isFinite(count) && count > 0
    ? count
    : undefined;
}

function resolveUnreadBadgePreference(
  value: string | undefined,
): UnreadBadgePreference {
  if (
    value === "all_unread" ||
    value === "only_inbox" ||
    value === "dont_display"
  ) {
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

  const totalUnread =
    feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;
  return unreadCountToBadgeCount(totalUnread);
}

type BadgeCommandResult = "applied" | "skipped" | "unavailable";

async function applyBadgeCountCommand(
  count: number | undefined,
  shouldApplyRequest: () => boolean,
): Promise<BadgeCommandResult> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = await getCurrentWindow();
    if (!shouldApplyRequest()) {
      return "skipped";
    }
    await currentWindow.setBadgeCount(count);
    return "applied";
  } catch {
    // Non-Tauri context (browser dev mode) — no-op
    return "unavailable";
  }
}

export function useBadge() {
  const badgeRequestSeqRef = useRef(0);
  const latestBadgeCountRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const badgePref = usePreferencesStore((s) =>
    resolveUnreadBadgePreference(s.prefs.unread_badge),
  );
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
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    badgeRequestSeqRef.current += 1;
    const requestSeq = badgeRequestSeqRef.current;
    latestBadgeCountRef.current = badgeCount;
    const shouldApplyRequest = (seq: number) =>
      mountedRef.current && badgeRequestSeqRef.current === seq;

    const replayLatestBadgeRequest = async (
      appliedRequestSeq: number,
    ): Promise<void> => {
      if (
        !mountedRef.current ||
        appliedRequestSeq === badgeRequestSeqRef.current
      ) {
        return;
      }

      const latestRequestSeq = badgeRequestSeqRef.current;
      await applyBadgeCountCommand(latestBadgeCountRef.current, () =>
        shouldApplyRequest(latestRequestSeq),
      );
      await replayLatestBadgeRequest(latestRequestSeq);
    };

    void (async () => {
      await applyBadgeCountCommand(badgeCount, () =>
        shouldApplyRequest(requestSeq),
      );
      await replayLatestBadgeRequest(requestSeq);
    })().catch((error: unknown) => {
      console.error("Failed to apply unread badge count:", error);
    });
  }, [badgeCount]);
}
