import type { ReactNode } from "react";
import { FeedTreeDragOverlay } from "./feed-tree-drag-overlay";
import { FeedTreeEmptyState } from "./feed-tree-empty-state";
import { type ActiveDropTarget, FeedTreeFolderSection, type FeedTreeFolderViewModel } from "./feed-tree-folder-section";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";
import { FeedTreeUnfolderedDropZone } from "./feed-tree-unfoldered-drop-zone";
import { FeedTreeUnfolderedSection } from "./feed-tree-unfoldered-section";
import { useFeedTreeDrag } from "./use-feed-tree-drag";

export type { ActiveDropTarget, FeedTreeFolderViewModel } from "./feed-tree-folder-section";
export type { FeedTreeFeedViewModel } from "./feed-tree-row";

export type FeedTreeViewProps = {
  isOpen: boolean;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  emptyState:
    | {
        kind: "message";
        message: string;
      }
    | {
        kind: "action";
        label: string;
        onAction: () => void;
      };
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

export function FeedTreeView({
  isOpen,
  folders,
  unfolderedFeeds,
  unfolderedLabel,
  onToggleFolder,
  onSelectFolder,
  onSelectFeed,
  displayFavicons,
  emptyState,
  renderFolderContextMenu,
  renderFeedContextMenu,
  canDragFeeds = false,
  draggedFeedId,
  activeDropTarget = null,
  onDragStartFeed,
  onDragEnterFolder,
  onDragEnterUnfoldered,
  onDropToFolder,
  onDropToUnfoldered,
  onDragEnd,
}: FeedTreeViewProps) {
  const hasFeeds = folders.length > 0 || unfolderedFeeds.length > 0;
  const hasUnfolderedFeeds = unfolderedFeeds.length > 0;
  const {
    activeUnfoldered,
    activeVisualDropTarget,
    consumeSuppressedHandleClick,
    handlePointerDownFeed,
    normalizedDraggedFeedId,
    pointerDragPreview,
    showUnfolderedDropZone,
  } = useFeedTreeDrag({
    isOpen,
    hasFeeds,
    canDragFeeds,
    activeDropTarget,
    draggedFeedId,
    onDragStartFeed,
    onDragEnterFolder,
    onDragEnterUnfoldered,
    onDropToFolder,
    onDropToUnfoldered,
    onDragEnd,
  });

  if (!hasFeeds) {
    return <FeedTreeEmptyState {...emptyState} />;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="space-y-1 px-2">
        {showUnfolderedDropZone ? (
          <FeedTreeUnfolderedDropZone
            enabled={canDragFeeds}
            active={activeUnfoldered}
            onDropToUnfoldered={onDropToUnfoldered}
          />
        ) : null}
        {folders.map((folder) => (
          <FeedTreeFolderSection
            key={folder.id}
            folder={folder}
            activeDropTarget={activeVisualDropTarget}
            draggedFeedId={normalizedDraggedFeedId}
            onToggleFolder={onToggleFolder}
            onSelectFolder={onSelectFolder}
            onSelectFeed={onSelectFeed}
            displayFavicons={displayFavicons}
            renderFolderContextMenu={renderFolderContextMenu}
            renderFeedContextMenu={renderFeedContextMenu}
            canDragFeeds={canDragFeeds}
            onDragStartFeed={onDragStartFeed}
            onDropToFolder={onDropToFolder}
            onPointerDownFeed={handlePointerDownFeed}
            consumeSuppressedHandleClick={consumeSuppressedHandleClick}
          />
        ))}
        {hasUnfolderedFeeds ? (
          <FeedTreeUnfolderedSection
            unfolderedFeeds={unfolderedFeeds}
            unfolderedLabel={unfolderedLabel}
            onSelectFeed={onSelectFeed}
            displayFavicons={displayFavicons}
            renderFeedContextMenu={renderFeedContextMenu}
            canDragFeeds={canDragFeeds}
            normalizedDraggedFeedId={normalizedDraggedFeedId}
            onDragStartFeed={onDragStartFeed}
            onPointerDownFeed={handlePointerDownFeed}
            consumeSuppressedHandleClick={consumeSuppressedHandleClick}
          />
        ) : null}
      </div>
      {pointerDragPreview ? (
        <FeedTreeDragOverlay preview={pointerDragPreview} displayFavicons={displayFavicons} />
      ) : null}
    </>
  );
}
