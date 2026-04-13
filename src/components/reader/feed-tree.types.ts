import type { Dispatch, MutableRefObject, ReactNode, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { TriStateDisplayMode } from "@/lib/article-display";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import type { FeedTreePointerDragSession } from "./feed-tree-drag-session";

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

export type FeedTreeRowProps = {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  isDragged?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};

export type FeedTreeUnfolderedSectionProps = {
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  onSelectFeed: FeedTreeRowProps["onSelectFeed"];
  displayFavicons: FeedTreeRowProps["displayFavicons"];
  renderFeedContextMenu?: FeedTreeRowProps["renderFeedContextMenu"];
  canDragFeeds: NonNullable<FeedTreeRowProps["canDragFeeds"]>;
  normalizedDraggedFeedId: string | null;
  onDragStartFeed?: FeedTreeRowProps["onDragStartFeed"];
  onPointerDownFeed: NonNullable<FeedTreeRowProps["onPointerDownFeed"]>;
  consumeSuppressedHandleClick: NonNullable<FeedTreeRowProps["consumeSuppressedHandleClick"]>;
};

export type UseFeedTreeDragParams = {
  isOpen: boolean;
  hasFeeds: boolean;
  canDragFeeds: boolean;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export type UseFeedTreeDragResult = {
  isPointerTracking: boolean;
  pointerDragPreview: FeedTreeDragOverlayPreview | null;
  activeVisualDropTarget: ActiveDropTarget;
  activeUnfoldered: boolean;
  showUnfolderedDropZone: boolean;
  normalizedDraggedFeedId: string | null;
  handlePointerDownFeed: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick: () => boolean;
};

export type UseFeedTreePointerDragEventsParams = {
  isPointerTracking: boolean;
  pointerDragRef: MutableRefObject<FeedTreePointerDragSession | null>;
  setPointerDragPreview: Dispatch<SetStateAction<FeedTreeDragOverlayPreview | null>>;
  setPointerHoverTarget: Dispatch<SetStateAction<ActiveDropTarget>>;
  queueSuppressHandleClickReset: () => void;
  clearPointerTracking: () => void;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export type ApplyFeedTreeHoverTargetParams = {
  target: ActiveDropTarget;
  setPointerHoverTarget: Dispatch<SetStateAction<ActiveDropTarget>>;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
};

export type FeedTreePointerDropOutcome =
  | { type: "clear" }
  | { type: "cancel" }
  | { type: "drop-folder"; folderId: string }
  | { type: "drop-unfoldered" }
  | { type: "drop-none" };

export type ApplyFeedTreePointerDropOutcomeParams = {
  outcome: FeedTreePointerDropOutcome;
  queueSuppressHandleClickReset: () => void;
  clearPointerTracking: () => void;
  onDragEnd?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
};
