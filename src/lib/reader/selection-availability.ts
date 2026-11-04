import type { FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { queryClient } from "@/lib/query/query-client";
import { normalizeQueryAccountId, queryKeys } from "@/lib/query/query-invalidation";
import { TAGS_QUERY_KEY } from "@/lib/query/query-keys";
import type { ReaderQuerySelection } from "@/lib/reader/reader-query";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";

const SMART_VIEW_PREFERENCE_KEYS = {
  unread: "show_sidebar_unread",
  starred: "show_sidebar_starred",
  recent: "show_sidebar_recent_articles",
} as const satisfies Record<Extract<ReaderQuerySelection, { type: "smart" }>["kind"], string>;

function isSidebarPreferenceEnabled(
  key: "show_sidebar_unread" | "show_sidebar_starred" | "show_sidebar_recent_articles" | "show_sidebar_tags",
): boolean {
  return resolvePreferenceValue(usePreferencesStore.getState().prefs, key) === "true";
}

/**
 * Treats a selection as available while its list is not cached yet, so unloaded caches never block history.
 * Smart views and tags hidden by sidebar preferences are unavailable because the visibility fallback would undo them.
 */
export function isSelectionStillAvailable(selection: ReaderQuerySelection, accountId: string | null): boolean {
  switch (selection.type) {
    case "feed": {
      const feeds = queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount(accountId));
      return feeds === undefined || feeds.some((feed) => feed.id === selection.feedId);
    }
    case "folder": {
      const folders = queryClient.getQueryData<FolderDto[]>([
        ...queryKeys.folders.root,
        normalizeQueryAccountId(accountId),
      ]);
      return folders === undefined || folders.some((folder) => folder.id === selection.folderId);
    }
    case "tag": {
      const tags = queryClient.getQueryData<TagDto[]>(TAGS_QUERY_KEY);
      return (
        isSidebarPreferenceEnabled("show_sidebar_tags") &&
        (tags === undefined || tags.some((tag) => tag.id === selection.tagId))
      );
    }
    case "smart":
      return isSidebarPreferenceEnabled(SMART_VIEW_PREFERENCE_KEYS[selection.kind]);
    default:
      return true;
  }
}
