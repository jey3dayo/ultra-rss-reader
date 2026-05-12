import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { FeedTreePointerDragSession } from "@/lib/sidebar/feed-tree-drag-session";
import type { ActiveDropTarget, FeedTreeFeedViewModel } from "../../feed-tree.types";
import type { FeedTreeDragOverlayPreview } from "../../feed-tree-drag-overlay";

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
