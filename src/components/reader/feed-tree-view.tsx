import { cn } from "cn";
import { useFeedTreeDrag } from "@/components/reader/hooks/feed-tree/use-feed-tree-drag";
import { useFolderTreeDrag } from "@/components/reader/hooks/feed-tree/use-folder-tree-drag";
import type { FeedTreeViewProps } from "./feed-tree.types";
import { FeedTreeDragOverlay } from "./feed-tree-drag-overlay";
import { FeedTreeEmptyState } from "./feed-tree-empty-state";
import { FeedTreeFolderDragOverlay } from "./feed-tree-folder-drag-overlay";
import { FeedTreeFolderSection } from "./feed-tree-folder-section";
import { FeedTreeRowCollapse } from "./feed-tree-row-collapse";
import { FeedTreeUnfolderedDropZone } from "./feed-tree-unfoldered-drop-zone";
import { FeedTreeUnfolderedSection } from "./feed-tree-unfoldered-section";
import { useFeedTreePresence } from "./hooks/sidebar/use-feed-tree-presence";
import { getSidebarDensityTokens } from "./sidebar-density";

const DEFAULT_FEED_TREE_SCOPE_KEY = "feed-tree-view";

export function FeedTreeView({
  isOpen,
  sidebarDensity = "normal",
  folders: logicalFolders,
  unfolderedFeeds: logicalUnfolderedFeeds,
  scopeKey = DEFAULT_FEED_TREE_SCOPE_KEY,
  unfolderedLabel,
  onToggleFolder,
  onSelectFolder,
  onSelectFeed,
  onMarkFeedRead,
  onMarkFolderRead,
  displayFavicons,
  emptyState,
  renderFolderContextMenu,
  renderFeedContextMenu,
  canDragFeeds = false,
  canDragFolders = false,
  draggedFeedId,
  draggedFolderId,
  folderDragInsertionIndex = null,
  activeDropTarget = null,
  feedTreeScrollContainerRef,
  onDragStartFeed,
  onDragStartFolder,
  onDragFolderInsertionChange,
  onDropFolderReorder,
  onDragEnterFolder,
  onDragEnterUnfoldered,
  onDropToFolder,
  onDropToUnfoldered,
  onDragEnd,
}: FeedTreeViewProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const { folders, unfolderedFeeds } = useFeedTreePresence({
    folders: logicalFolders,
    unfolderedFeeds: logicalUnfolderedFeeds,
    scopeKey,
  });
  const hasFeeds = folders.length > 0 || unfolderedFeeds.length > 0;
  const hasUnfolderedFeeds = unfolderedFeeds.length > 0;
  const isFolderDragging = draggedFolderId !== null && draggedFolderId !== undefined;
  const effectiveCanDragFeeds = canDragFeeds && !isFolderDragging;

  const {
    activeUnfoldered,
    activeVisualDropTarget,
    consumeSuppressedHandleClick: consumeFeedDragClickSuppression,
    handlePointerDownFeed,
    normalizedDraggedFeedId,
    pointerDragPreview,
    showUnfolderedDropZone,
  } = useFeedTreeDrag({
    isOpen,
    hasFeeds,
    canDragFeeds: effectiveCanDragFeeds,
    activeDropTarget,
    draggedFeedId,
    scrollContainerRef: feedTreeScrollContainerRef,
    onDragStartFeed,
    onDragEnterFolder,
    onDragEnterUnfoldered,
    onDropToFolder,
    onDropToUnfoldered,
    onDragEnd,
  });

  const {
    handlePointerDownFolder,
    pointerDragPreview: folderPointerDragPreview,
    consumeSuppressedHandleClick: consumeFolderDragClickSuppression,
  } = useFolderTreeDrag({
    isOpen,
    canDragFolders,
    draggedFolderId,
    scrollContainerRef: feedTreeScrollContainerRef,
    onDragStartFolder,
    onDragFolderInsertionChange,
    onDropFolderReorder,
    onDragEnd,
  });

  const consumeSuppressedHandleClick = () => consumeFeedDragClickSuppression() || consumeFolderDragClickSuppression();

  if (!hasFeeds) {
    if (!isOpen) {
      return null;
    }
    return <FeedTreeEmptyState {...emptyState} />;
  }

  return (
    <div
      data-state={isOpen ? "open" : "closed"}
      aria-hidden={isOpen ? "false" : "true"}
      inert={isOpen ? undefined : true}
      className="motion-disclosure-panel"
    >
      <div className="motion-disclosure-body">
        <div className={cn(tokens.treeRootPadding, tokens.treeGap)}>
          {showUnfolderedDropZone && !isFolderDragging ? (
            <FeedTreeUnfolderedDropZone
              enabled={effectiveCanDragFeeds}
              active={activeUnfoldered}
              onDropToUnfoldered={onDropToUnfoldered}
            />
          ) : null}
          {folders.map((folder, folderIndex) => (
            <FeedTreeRowCollapse key={folder.id} collapsing={folder.isLeaving}>
              <FeedTreeFolderSection
                sidebarDensity={sidebarDensity}
                folder={folder}
                folderIndex={folderIndex}
                activeDropTarget={isFolderDragging ? null : activeVisualDropTarget}
                draggedFeedId={normalizedDraggedFeedId}
                draggedFolderId={draggedFolderId}
                folderDragInsertionIndex={folderDragInsertionIndex}
                onToggleFolder={onToggleFolder}
                onSelectFolder={onSelectFolder}
                onSelectFeed={onSelectFeed}
                onMarkFeedRead={onMarkFeedRead}
                onMarkFolderRead={onMarkFolderRead}
                displayFavicons={displayFavicons}
                renderFolderContextMenu={renderFolderContextMenu}
                renderFeedContextMenu={renderFeedContextMenu}
                canDragFeeds={effectiveCanDragFeeds}
                canDragFolders={canDragFolders}
                onDragStartFeed={onDragStartFeed}
                onDropToFolder={onDropToFolder}
                onPointerDownFeed={handlePointerDownFeed}
                onPointerDownFolder={handlePointerDownFolder}
                consumeSuppressedHandleClick={consumeSuppressedHandleClick}
              />
            </FeedTreeRowCollapse>
          ))}
          {hasUnfolderedFeeds ? (
            <FeedTreeUnfolderedSection
              sidebarDensity={sidebarDensity}
              unfolderedFeeds={unfolderedFeeds}
              unfolderedLabel={unfolderedLabel}
              onSelectFeed={onSelectFeed}
              onMarkFeedRead={onMarkFeedRead}
              displayFavicons={displayFavicons}
              renderFeedContextMenu={renderFeedContextMenu}
              canDragFeeds={effectiveCanDragFeeds}
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
        {folderPointerDragPreview ? (
          <FeedTreeFolderDragOverlay preview={folderPointerDragPreview} displayFavicons={displayFavicons} />
        ) : null}
      </div>
    </div>
  );
}
