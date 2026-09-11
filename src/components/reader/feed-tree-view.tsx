import { useFeedTreeDrag } from "@/components/reader/hooks/feed-tree/use-feed-tree-drag";
import { cn } from "@/lib/utils";
import type { FeedTreeViewProps } from "./feed-tree.types";
import { FeedTreeDragOverlay } from "./feed-tree-drag-overlay";
import { FeedTreeEmptyState } from "./feed-tree-empty-state";
import { FeedTreeFolderSection } from "./feed-tree-folder-section";
import { FeedTreeRowCollapse } from "./feed-tree-row-collapse";
import { FeedTreeUnfolderedDropZone } from "./feed-tree-unfoldered-drop-zone";
import { FeedTreeUnfolderedSection } from "./feed-tree-unfoldered-section";
import { useFeedTreePresence } from "./hooks/sidebar/use-feed-tree-presence";
import { getSidebarDensityTokens } from "./sidebar-density";

// Stable fallback scope for call sites (tests, stories) that never switch
// account/view-mode scope and so have no reason to pass `scopeKey`: a
// constant scope means useFeedTreePresence's scope-reset path never fires
// for them, which matches their previous (pre-presence) behavior.
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
  // The presence output (not the raw logical props) decides emptiness and
  // what gets rendered: a row/folder can still be present here (isLeaving)
  // for its exit animation after it has already disappeared from the
  // logical tree, and the empty state must not flash in underneath it.
  const { folders, unfolderedFeeds } = useFeedTreePresence({
    folders: logicalFolders,
    unfolderedFeeds: logicalUnfolderedFeeds,
    scopeKey,
  });
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
          {showUnfolderedDropZone ? (
            <FeedTreeUnfolderedDropZone
              enabled={canDragFeeds}
              active={activeUnfoldered}
              onDropToUnfoldered={onDropToUnfoldered}
            />
          ) : null}
          {folders.map((folder) => (
            <FeedTreeRowCollapse key={folder.id} collapsing={folder.isLeaving}>
              <FeedTreeFolderSection
                sidebarDensity={sidebarDensity}
                folder={folder}
                activeDropTarget={activeVisualDropTarget}
                draggedFeedId={normalizedDraggedFeedId}
                onToggleFolder={onToggleFolder}
                onSelectFolder={onSelectFolder}
                onSelectFeed={onSelectFeed}
                onMarkFeedRead={onMarkFeedRead}
                onMarkFolderRead={onMarkFolderRead}
                displayFavicons={displayFavicons}
                renderFolderContextMenu={renderFolderContextMenu}
                renderFeedContextMenu={renderFeedContextMenu}
                canDragFeeds={canDragFeeds}
                onDragStartFeed={onDragStartFeed}
                onDropToFolder={onDropToFolder}
                onPointerDownFeed={handlePointerDownFeed}
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
      </div>
    </div>
  );
}
