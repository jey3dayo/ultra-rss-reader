import type { FeedDto, FolderDto, TagDto } from "@/api/tauri-commands";
import { queryClient } from "@/lib/query/query-client";
import { normalizeQueryAccountId, queryKeys } from "@/lib/query/query-invalidation";
import { TAGS_QUERY_KEY } from "@/lib/query/query-keys";
import type { ReaderQuerySelection } from "@/lib/reader/reader-query";

/** Treats a selection as available while its list is not cached yet, so unloaded caches never block history. */
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
      return tags === undefined || tags.some((tag) => tag.id === selection.tagId);
    }
    default:
      return true;
  }
}
