import { useEffect, useMemo, useRef } from "react";
import type { FeedDto } from "@/api/schemas/feed";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";
import { useFeeds } from "@/hooks/use-feeds";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { getWindowBadgeCountTarget, type WindowBadgeCountTarget } from "@/lib/window/tauri-window";
import type { UnreadBadgePreference } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const MAX_BADGE_COUNT = Number.MAX_SAFE_INTEGER;

function unreadCountToBadgeCount(count: number | undefined): number | undefined {
  if (count === undefined || !Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    return undefined;
  }

  return Math.min(count, MAX_BADGE_COUNT);
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

type BadgeCommandResult = "applied" | "skipped" | "unavailable";

async function applyBadgeCountCommand(
  count: number | undefined,
  shouldApplyRequest: () => boolean,
): Promise<BadgeCommandResult> {
  let currentWindow: WindowBadgeCountTarget;
  try {
    currentWindow = await getWindowBadgeCountTarget();
  } catch (error: unknown) {
    logRuntimeDiagnostic("unread-badge-runtime-unavailable", "Unread badge window target is unavailable:", error);
    return "unavailable";
  }

  if (typeof currentWindow.setBadgeCount !== "function") {
    logRuntimeDiagnostic("unread-badge-runtime-unavailable", "Unread badge command is unavailable on this window.");
    return "unavailable";
  }

  if (!shouldApplyRequest()) {
    return "skipped";
  }

  try {
    await currentWindow.setBadgeCount(count);
    return "applied";
  } catch (error: unknown) {
    logRuntimeDiagnostic("unread-badge-command-failure", "Failed to apply unread badge count:", error);
    return "unavailable";
  }
}

export function useBadge() {
  const badgeRequestSeqRef = useRef(0);
  const latestBadgeCountRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const badgePref = usePreferencesStore((s) => resolveUnreadBadgePreference(s.prefs.unread_badge));
  const feedAccountId = badgePref === "all_unread" ? selectedAccountId : null;
  const { data: feeds, isFetching: feedsFetching } = useFeeds(feedAccountId);
  const { data: accountUnreadCount, isFetching: accountUnreadCountFetching } = useAccountUnreadCount(
    selectedAccountId,
    badgePref === "only_inbox" && selectedAccountId !== null,
  );
  const badgeCount = useMemo(() => {
    const isWaitingForAllUnread = badgePref === "all_unread" && feeds === undefined && feedsFetching;
    const isWaitingForOnlyInbox =
      badgePref === "only_inbox" && accountUnreadCount === undefined && accountUnreadCountFetching;

    if (selectedAccountId !== null && (isWaitingForAllUnread || isWaitingForOnlyInbox)) {
      return latestBadgeCountRef.current;
    }

    return resolveBadgeCount({
      accountUnreadCount,
      badgePref,
      feeds,
      selectedAccountId,
    });
  }, [accountUnreadCount, accountUnreadCountFetching, badgePref, feeds, feedsFetching, selectedAccountId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    badgeRequestSeqRef.current += 1;
    const requestSeq = badgeRequestSeqRef.current;
    latestBadgeCountRef.current = badgeCount;
    const shouldApplyRequest = (seq: number) => mountedRef.current && badgeRequestSeqRef.current === seq;

    const replayLatestBadgeRequest = async (appliedRequestSeq: number): Promise<void> => {
      if (!mountedRef.current || appliedRequestSeq === badgeRequestSeqRef.current) {
        return;
      }

      const latestRequestSeq = badgeRequestSeqRef.current;
      return applyBadgeCountCommand(latestBadgeCountRef.current, () => shouldApplyRequest(latestRequestSeq)).then(() =>
        replayLatestBadgeRequest(latestRequestSeq),
      );
    };

    void applyBadgeCountCommand(badgeCount, () => shouldApplyRequest(requestSeq))
      .then(
        () => replayLatestBadgeRequest(requestSeq),
        (error: unknown) => {
          logRuntimeDiagnostic("unread-badge", "Failed to apply unread badge count:", error);
        },
      )
      .catch((error: unknown) => {
        logRuntimeDiagnostic("unread-badge", "Failed to apply unread badge count:", error);
      });
  }, [badgeCount]);
}
