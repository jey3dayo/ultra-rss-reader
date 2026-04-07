import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FeedTreeDragOverlay } from "./feed-tree-drag-overlay";
import { type ActiveDropTarget, FeedTreeFolderSection, type FeedTreeFolderViewModel } from "./feed-tree-folder-section";
import { type FeedTreeFeedViewModel, FeedTreeRow } from "./feed-tree-row";
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

function UnfolderedDropZone({
  enabled,
  active,
  onDropToUnfoldered,
}: {
  enabled: boolean;
  active: boolean;
  onDropToUnfoldered?: () => void;
}) {
  const isActive = active;

  if (!enabled) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Move to no folder"
      data-testid="unfoldered-drop-zone"
      data-feed-drop-kind="unfoldered"
      className={cn(
        "w-full rounded-md text-left transition-all",
        isActive
          ? "min-h-8 border border-dashed border-sidebar-border bg-sidebar-accent/60 px-2 py-1 text-xs text-sidebar-accent-foreground"
          : "h-2 border border-transparent bg-sidebar-border/30",
      )}
      onClick={() => {
        if (!enabled) {
          return;
        }
        onDropToUnfoldered?.();
      }}
    >
      {isActive ? "Drop here to remove from folder" : null}
    </button>
  );
}

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
    return (
      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
        {emptyState.kind === "message" ? (
          emptyState.message
        ) : (
          <button
            type="button"
            onClick={emptyState.onAction}
            className="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50"
          >
            {emptyState.label}
          </button>
        )}
      </div>
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="space-y-1 px-2">
        {showUnfolderedDropZone ? (
          <UnfolderedDropZone
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
        {hasUnfolderedFeeds && (
          <div className="space-y-2">
            {unfolderedLabel ? (
              <div className="ml-2 px-3 text-[0.68rem] font-medium tracking-[0.08em] text-sidebar-foreground/32 uppercase">
                {unfolderedLabel}
              </div>
            ) : null}
            <div className="ml-2 space-y-1 border-l border-sidebar-border/25 pl-3">
              {unfolderedFeeds.map((feed) => (
                <FeedTreeRow
                  key={feed.id}
                  feed={feed}
                  displayFavicons={displayFavicons}
                  onSelectFeed={onSelectFeed}
                  renderFeedContextMenu={renderFeedContextMenu}
                  canDragFeeds={canDragFeeds}
                  isDragged={normalizedDraggedFeedId === feed.id}
                  onDragStartFeed={onDragStartFeed}
                  onPointerDownFeed={handlePointerDownFeed}
                  consumeSuppressedHandleClick={consumeSuppressedHandleClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {pointerDragPreview ? (
        <FeedTreeDragOverlay preview={pointerDragPreview} displayFavicons={displayFavicons} />
      ) : null}
    </>
  );
}
