import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import type { ActiveDropTarget } from "@/lib/sidebar/feed-tree-drag.types";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "@/lib/sidebar/sidebar-feed-tree";
import type { SidebarDensity } from "./sidebar-density";

export type { ActiveDropTarget } from "@/lib/sidebar/feed-tree-drag.types";
export type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "@/lib/sidebar/sidebar-feed-tree";

export type FeedTreeEmptyState =
  | { kind: "hidden"; text?: never; message?: never; label?: never }
  | { kind: "message"; text: string; message?: never; label?: never }
  | { kind: "loading"; text: string; message?: never; label?: never }
  | { kind: "action"; text: string; onAction: () => void; message?: never; label?: never }
  | { kind: "message"; message: string; text?: never; label?: never }
  | { kind: "loading"; label: string; text?: never; message?: never }
  | { kind: "action"; label: string; onAction: () => void; text?: never; message?: never };

export type FeedTreeViewProps = {
  isOpen: boolean;
  sidebarDensity?: SidebarDensity;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: (feed: FeedTreeFeedViewModel) => void;
  onMarkFolderRead?: (folder: FeedTreeFolderViewModel) => void;
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

export type FeedTreeRowProps = {
  sidebarDensity?: SidebarDensity;
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: FeedTreeViewProps["onMarkFeedRead"];
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  isDragged?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};
