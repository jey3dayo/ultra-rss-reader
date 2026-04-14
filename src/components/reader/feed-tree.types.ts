import type { Dispatch, MutableRefObject, ReactNode, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { TriStateDisplayMode } from "@/lib/article-display";
import type { FeedTreeDragOverlayPreview } from "./feed-tree-drag-overlay";
import type { FeedTreePointerDragSession } from "./feed-tree-drag-session";
import type { SidebarDensity } from "./sidebar-density";

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
  | { kind: "message"; text: string; message?: never; label?: never }
  | { kind: "loading"; text: string; message?: never; label?: never }
  | { kind: "action"; text: string; onAction: () => void; message?: never; label?: never }
  | { kind: "message"; message: string; text?: never; label?: never }
  | { kind: "loading"; label: string; text?: never; message?: never }
  | { kind: "action"; label: string; onAction: () => void; text?: never; message?: never };

export type FeedTreeEmptyStateProps = FeedTreeEmptyState;

export type FeedTreeViewProps = {
  isOpen: boolean;
  sidebarDensity?: SidebarDensity;
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
  sidebarDensity?: SidebarDensity;
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
  sidebarDensity?: SidebarDensity;
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

export type FeedTreeDragHandleProps = {
  feedTitle: string;
  sidebarDensity?: SidebarDensity;
  canDragFeeds?: FeedTreeRowProps["canDragFeeds"];
  isArmed?: FeedTreeRowProps["isDragged"];
  onArm?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedClick?: FeedTreeRowProps["consumeSuppressedHandleClick"];
};

export type FeedTreeUnfolderedSectionProps = {
  sidebarDensity?: SidebarDensity;
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

export type FeedTreeUnfolderedDropZoneProps = {
  enabled: boolean;
  active: boolean;
  onDropToUnfoldered?: () => void;
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
