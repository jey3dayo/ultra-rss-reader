import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import type { TriStateDisplayMode } from "@/lib/article-display";

export type FeedTreeFeedViewModel = {
  id: string;
  accountId: string;
  folderId: string | null;
  title: string;
  url: string;
  siteUrl: string;
  unreadCount: number;
  readerMode: TriStateDisplayMode;
  webPreviewMode: TriStateDisplayMode;
  isSelected: boolean;
  grayscaleFavicon: boolean;
};

export type FeedTreeFolderViewModel = {
  id: string;
  name: string;
  accountId: string;
  sortOrder: number;
  unreadCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  feeds: FeedTreeFeedViewModel[];
};

export type ActiveDropTarget = { kind: "folder"; folderId: string } | { kind: "unfoldered" } | null;

export type FeedTreeEmptyState =
  | { kind: "message"; message: string }
  | { kind: "action"; label: string; onAction: () => void };

export type FeedTreeViewProps = {
  isOpen: boolean;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  emptyState: FeedTreeEmptyState;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  draggedFeedId?: string | null;
  activeDropTarget?: ActiveDropTarget;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export type FeedTreeFolderSectionProps = {
  folder: FeedTreeFolderViewModel;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDropToFolder?: (folderId: string) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};
