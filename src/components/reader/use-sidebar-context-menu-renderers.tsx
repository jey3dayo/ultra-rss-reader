import { useCallback } from "react";
import { FeedContextMenuContent } from "./feed-context-menu";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { FolderContextMenuContent } from "./folder-context-menu";
import type { SidebarContextMenuRenderersResult } from "./sidebar.types";
import { TagContextMenuContent } from "./tag-context-menu";
import type { TagListItemViewModel } from "./tag-list-view";
import { TagSectionContextMenu } from "./tag-section-context-menu";

type UseSidebarContextMenuRenderersParams = {
  onManageTags: () => void;
};

export function useSidebarContextMenuRenderers({
  onManageTags,
}: UseSidebarContextMenuRenderersParams): SidebarContextMenuRenderersResult {
  const renderFolderContextMenu = useCallback(
    (folder: FeedTreeFolderViewModel) => (
      <FolderContextMenuContent
        folder={{
          id: folder.id,
          account_id: folder.accountId,
          name: folder.name,
          sort_order: folder.sortOrder,
        }}
        folderUnread={folder.unreadCount}
      />
    ),
    [],
  );

  const renderFeedContextMenu = useCallback(
    (feed: FeedTreeFeedViewModel) => (
      <FeedContextMenuContent
        feed={{
          id: feed.id,
          account_id: feed.accountId,
          folder_id: feed.folderId,
          title: feed.title,
          url: feed.url,
          site_url: feed.siteUrl,
          unread_count: feed.unreadCount,
          reader_mode: feed.readerMode,
          web_preview_mode: feed.webPreviewMode,
        }}
      />
    ),
    [],
  );

  const renderTagContextMenu = useCallback(
    (tag: TagListItemViewModel) => <TagContextMenuContent tag={{ id: tag.id, name: tag.name, color: tag.color }} />,
    [],
  );

  const renderTagSectionContextMenu = useCallback(
    () => <TagSectionContextMenu onManageTags={onManageTags} />,
    [onManageTags],
  );

  return {
    renderFolderContextMenu,
    renderFeedContextMenu,
    renderTagContextMenu,
    renderTagSectionContextMenu,
  };
}
