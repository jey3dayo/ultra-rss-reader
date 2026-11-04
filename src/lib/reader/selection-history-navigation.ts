import type { FeedDto } from "@/api/tauri-commands";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { isSelectionStillAvailable } from "@/lib/reader/selection-availability";
import { findSelectionHistoryTarget, type SelectionHistoryDirection } from "@/lib/reader/selection-history";
import type { UiStoreState } from "@/stores/ui-store.types";

export function getFeedFolderId(feedId: string, accountId: string | null): string | null {
  const feeds = queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount(accountId));
  return feeds?.find((feed) => feed.id === feedId)?.folder_id ?? null;
}

/** Restores the nearest available history entry; returns false when there is nowhere to go. */
export function moveSelectionHistory(store: UiStoreState, direction: SelectionHistoryDirection): boolean {
  if (store.subscriptionsWorkspace !== null) {
    return false;
  }

  const targetIndex = findSelectionHistoryTarget(store.selectionHistory, direction, store.selection, (selection) =>
    isSelectionStillAvailable(selection, store.selectedAccountId),
  );
  const target = targetIndex === null ? undefined : store.selectionHistory.entries[targetIndex];
  if (targetIndex === null || target === undefined) {
    return false;
  }

  store.restoreSelectionFromHistory(targetIndex, {
    expandFolderId: target.type === "feed" ? getFeedFolderId(target.feedId, store.selectedAccountId) : null,
  });
  return true;
}
