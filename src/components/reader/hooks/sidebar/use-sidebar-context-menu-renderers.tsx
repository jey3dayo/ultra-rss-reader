import { useCallback } from "react";
import type { FolderOrderMode } from "@/lib/sidebar/folder-order";
import { FeedContextMenuContent } from "../../feed-context-menu";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "../../feed-tree.types";
import { FolderContextMenuContent } from "../../folder-context-menu";
import type { SidebarContextMenuRenderersResult } from "../../sidebar.types";
import { SubscriptionsSectionContextMenu } from "../../subscriptions-section-context-menu";
import { TagContextMenuContent } from "../../tag-context-menu";
import { TagSectionContextMenu } from "../../tag-section-context-menu";
import type { SidebarTagItem } from "./use-sidebar-tag-items";

type UseSidebarContextMenuRenderersParams = {
  folders: Array<{ id: string }> | undefined;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  onManageTags: () => void;
  folderOrderMode?: FolderOrderMode;
  onMoveFolderUp?: (folderId: string) => void;
  onMoveFolderDown?: (folderId: string) => void;
  onResetFolderOrder?: () => void;
  getVisibleFolderMenuState?: (folderId: string) => {
    visibleIndex: number;
    visibleCount: number;
    canMoveUp: boolean;
    canMoveDown: boolean;
  };
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
    remote_id: null,
    title: feed.title,
    url: feed.url,
    site_url: feed.siteUrl,
    icon_url: null,
    unread_count: feed.unreadCount,
    reader_mode: feed.readerMode,
    web_preview_mode: feed.webPreviewMode,
  };
}

function toTagContextMenuTag(tag: SidebarTagItem) {
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
  folderOrderMode = "name",
  onMoveFolderUp,
  onMoveFolderDown,
  onResetFolderOrder,
  getVisibleFolderMenuState,
}: UseSidebarContextMenuRenderersParams): SidebarContextMenuRenderersResult {
  const renderFolderContextMenu = useCallback(
    (folder: FeedTreeFolderViewModel) => {
      const menuState = getVisibleFolderMenuState?.(folder.id) ?? {
        visibleIndex: -1,
        visibleCount: folders?.length ?? 0,
        canMoveUp: false,
        canMoveDown: false,
      };

      return (
        <FolderContextMenuContent
          folder={toFolderContextMenuFolder(folder)}
          folderUnread={folder.unreadCount}
          feeds={folder.feeds.map(toFeedContextMenuFeed)}
          folderOrderMode={folderOrderMode}
          visibleFolderIndex={menuState.visibleIndex}
          visibleFolderCount={menuState.visibleCount}
          canMoveFolderUp={menuState.canMoveUp}
          canMoveFolderDown={menuState.canMoveDown}
          onMoveFolderUp={() => onMoveFolderUp?.(folder.id)}
          onMoveFolderDown={() => onMoveFolderDown?.(folder.id)}
          onResetFolderOrder={() => onResetFolderOrder?.()}
        />
      );
    },
    [folderOrderMode, folders?.length, getVisibleFolderMenuState, onMoveFolderDown, onMoveFolderUp, onResetFolderOrder],
  );

  const renderFeedContextMenu = useCallback(
    (feed: FeedTreeFeedViewModel) => <FeedContextMenuContent feed={toFeedContextMenuFeed(feed)} />,
    [],
  );

  const renderTagContextMenu = useCallback(
    (tag: SidebarTagItem) => <TagContextMenuContent tag={toTagContextMenuTag(tag)} />,
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
