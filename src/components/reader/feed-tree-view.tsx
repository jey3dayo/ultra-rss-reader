import { cn } from "@/lib/utils";
import type { FeedTreeViewProps } from "./feed-tree.types";
import { FeedTreeDragOverlay } from "./feed-tree-drag-overlay";
import { FeedTreeEmptyState } from "./feed-tree-empty-state";
import { FeedTreeFolderSection } from "./feed-tree-folder-section";
import { FeedTreeUnfolderedDropZone } from "./feed-tree-unfoldered-drop-zone";
import { FeedTreeUnfolderedSection } from "./feed-tree-unfoldered-section";
import { getSidebarDensityTokens } from "./sidebar-density";
import { useFeedTreeDrag } from "./use-feed-tree-drag";

export type {
  ActiveDropTarget,
  FeedTreeFeedViewModel,
  FeedTreeFolderViewModel,
  FeedTreeViewProps,
} from "./feed-tree.types";

export function FeedTreeView({
  isOpen,
  sidebarDensity = "normal",
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
  const tokens = getSidebarDensityTokens(sidebarDensity);
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
      <div className={cn("px-2", tokens.treeGap)}>
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
            sidebarDensity={sidebarDensity}
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
            sidebarDensity={sidebarDensity}
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
