import { useCallback } from "react";
import { FeedContextMenuContent } from "./feed-context-menu";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { FolderContextMenuContent } from "./folder-context-menu";
import type { SidebarContextMenuRenderersResult } from "./sidebar.types";
import { SubscriptionsSectionContextMenu } from "./subscriptions-section-context-menu";
import { TagContextMenuContent } from "./tag-context-menu";
import type { TagListItemViewModel } from "./tag-list-view";
import { TagSectionContextMenu } from "./tag-section-context-menu";

type UseSidebarContextMenuRenderersParams = {
  folders: Array<{ id: string }> | undefined;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  onManageTags: () => void;
};

function toFolderContextMenuFolder(folder: FeedTreeFolderViewModel) {
  return {
    id: folder.id,
    account_id: folder.accountId,
    name: folder.name,
    sort_order: folder.sortOrder,
  };
}

function toFeedContextMenuFeed(feed: FeedTreeFeedViewModel) {
  return {
    id: feed.id,
    account_id: feed.accountId,
    folder_id: feed.folderId,
    title: feed.title,
    url: feed.url,
    site_url: feed.siteUrl,
    unread_count: feed.unreadCount,
    reader_mode: feed.readerMode,
    web_preview_mode: feed.webPreviewMode,
  };
}

function toTagContextMenuTag(tag: TagListItemViewModel) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
}

export function useSidebarContextMenuRenderers({
  folders,
  setExpandedFolders,
  onManageTags,
}: UseSidebarContextMenuRenderersParams): SidebarContextMenuRenderersResult {
  const renderFolderContextMenu = useCallback(
    (folder: FeedTreeFolderViewModel) => (
      <FolderContextMenuContent
        folder={toFolderContextMenuFolder(folder)}
        folderUnread={folder.unreadCount}
        feeds={folder.feeds.map(toFeedContextMenuFeed)}
      />
    ),
    [],
  );

  const renderFeedContextMenu = useCallback(
    (feed: FeedTreeFeedViewModel) => <FeedContextMenuContent feed={toFeedContextMenuFeed(feed)} />,
    [],
  );

  const renderTagContextMenu = useCallback(
    (tag: TagListItemViewModel) => <TagContextMenuContent tag={toTagContextMenuTag(tag)} />,
    [],
  );

  const renderTagSectionContextMenu = useCallback(
    () => <TagSectionContextMenu onManageTags={onManageTags} />,
    [onManageTags],
  );

  const renderSubscriptionsSectionContextMenu = useCallback(
    () => (
      <SubscriptionsSectionContextMenu
        folderIds={(folders ?? []).map((folder) => folder.id)}
        onExpandAllFolders={(folderIds) => setExpandedFolders(folderIds)}
        onCollapseAllFolders={() => setExpandedFolders([])}
      />
    ),
    [folders, setExpandedFolders],
  );

  return {
    renderFolderContextMenu,
    renderFeedContextMenu,
    renderTagContextMenu,
    renderTagSectionContextMenu,
    renderSubscriptionsSectionContextMenu,
  };
}
