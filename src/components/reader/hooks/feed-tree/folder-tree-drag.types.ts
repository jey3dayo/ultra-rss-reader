import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { FolderTreePointerDragSession } from "@/lib/sidebar/folder-tree-drag-session";
import type { FolderReorderDropTarget } from "@/lib/sidebar/folder-tree-drop-target";
import type { FeedTreeFolderViewModel, FeedTreePresenceFolderViewModel } from "../../feed-tree.types";

export type FolderTreeDragOverlayPreview = {
  folder: FeedTreeFolderViewModel;
  x: number;
  y: number;
};

export type UseFolderTreeDragParams = {
  isOpen: boolean;
  canDragFolders: boolean;
  draggedFolderId?: string | null;
  folderDragInsertionIndex?: number | null;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onDragStartFolder?: (folder: FeedTreeFolderViewModel) => void;
  onDragFolderInsertionChange?: (insertionIndex: number | null) => void;
  onDropFolderReorder?: (folderId: string, insertionIndex: number) => void;
  onDragEnd?: () => void;
};

export type UseFolderTreeDragResult = {
  isPointerTracking: boolean;
  pointerDragPreview: FolderTreeDragOverlayPreview | null;
  normalizedDraggedFolderId: string | null;
  handlePointerDownFolder: (folder: FeedTreePresenceFolderViewModel, event: ReactPointerEvent<HTMLElement>) => void;
  consumeSuppressedHandleClick: () => boolean;
};

export type UseFolderTreePointerDragEventsParams = {
  isPointerTracking: boolean;
  pointerDragRef: MutableRefObject<FolderTreePointerDragSession | null>;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  setPointerDragPreview: (value: FolderTreeDragOverlayPreview | null) => void;
  setDropTarget: (value: FolderReorderDropTarget) => void;
  queueSuppressHandleClickReset: () => void;
  clearPointerTracking: () => void;
  onDragStartFolder?: (folder: FeedTreeFolderViewModel) => void;
  onDragFolderInsertionChange?: (insertionIndex: number | null) => void;
  onDropFolderReorder?: (folderId: string, insertionIndex: number) => void;
  onDragEnd?: () => void;
};
