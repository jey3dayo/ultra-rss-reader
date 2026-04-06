import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import type { TriStateDisplayMode } from "@/lib/article-display";
import { cn } from "@/lib/utils";
import { SidebarNavButton } from "./sidebar-nav-button";

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

const DROP_TARGET_KIND_ATTRIBUTE = "data-feed-drop-kind";
const DROP_TARGET_ID_ATTRIBUTE = "data-feed-drop-target";
const POINTER_DRAG_THRESHOLD = 6;

type PointerDragSession = {
  feed: FeedTreeFeedViewModel;
  pointerId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
  hoverTarget: ActiveDropTarget;
};

type PointerDragPreview = {
  feed: FeedTreeFeedViewModel;
  x: number;
  y: number;
};

function isSameDropTarget(left: ActiveDropTarget, right: ActiveDropTarget): boolean {
  if (left?.kind !== right?.kind) {
    return false;
  }
  if (left?.kind === "folder" && right?.kind === "folder") {
    return left.folderId === right.folderId;
  }
  return left === right;
}

function getDropTargetFromElement(element: Element | null): ActiveDropTarget {
  const dropTarget = element?.closest<HTMLElement>(`[${DROP_TARGET_KIND_ATTRIBUTE}]`);
  if (!dropTarget) {
    return null;
  }

  const kind = dropTarget.getAttribute(DROP_TARGET_KIND_ATTRIBUTE);
  if (kind === "folder") {
    const folderId = dropTarget.getAttribute(DROP_TARGET_ID_ATTRIBUTE);
    return folderId ? { kind: "folder", folderId } : null;
  }

  if (kind === "unfoldered") {
    return { kind: "unfoldered" };
  }

  return null;
}

export type FeedTreeViewProps = {
  isOpen: boolean;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
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

function DragHandle({
  feedTitle,
  canDragFeeds,
  isArmed,
  onArm,
  onPointerDown,
  consumeSuppressedClick,
}: {
  feedTitle: string;
  canDragFeeds?: boolean;
  isArmed?: boolean;
  onArm?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedClick?: () => boolean;
}) {
  if (!canDragFeeds) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={`Drag ${feedTitle}`}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (consumeSuppressedClick?.()) {
          return;
        }
        onArm?.();
      }}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-sidebar-foreground/40 opacity-0 transition-opacity hover:bg-sidebar-accent/40 hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/feed-row:opacity-100 group-focus-within/feed-row:opacity-100",
        isArmed && "bg-sidebar-accent/60 text-foreground opacity-100",
      )}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

function FeedRow({
  feed,
  displayFavicons,
  onSelectFeed,
  renderFeedContextMenu,
  canDragFeeds,
  isDragged = false,
  onDragStartFeed,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  isDragged?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
}) {
  return (
    <div className={cn("group/feed-row relative", isDragged && "opacity-70")}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
        <div className="pointer-events-auto">
          <DragHandle
            feedTitle={feed.title}
            canDragFeeds={canDragFeeds}
            isArmed={isDragged}
            onArm={() => onDragStartFeed?.(feed)}
            onPointerDown={(event) => onPointerDownFeed?.(feed, event)}
            consumeSuppressedClick={consumeSuppressedHandleClick}
          />
        </div>
      </div>
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={
            <SidebarNavButton
              selected={feed.isSelected}
              trailing={feed.unreadCount > 0 ? feed.unreadCount.toLocaleString() : undefined}
              className={cn(canDragFeeds && "pl-5")}
            />
          }
          onClick={() => onSelectFeed(feed.id)}
        >
          {displayFavicons && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.siteUrl} grayscale={feed.grayscaleFavicon} />
            </span>
          )}
          <span className="truncate">{feed.title}</span>
        </ContextMenu.Trigger>
        {renderFeedContextMenu?.(feed)}
      </ContextMenu.Root>
    </div>
  );
}

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

function FolderSection({
  folder,
  activeDropTarget,
  draggedFeedId,
  onToggleFolder,
  onSelectFolder,
  onSelectFeed,
  displayFavicons,
  renderFolderContextMenu,
  renderFeedContextMenu,
  canDragFeeds,
  onDragStartFeed,
  onDropToFolder,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: {
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
}) {
  const showDropOverlay = canDragFeeds && draggedFeedId !== null;
  const isActive = canDragFeeds && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;

  return (
    <div
      className={cn("relative rounded-md", isActive && "bg-sidebar-accent/20")}
      data-feed-drop-kind={canDragFeeds ? "folder" : undefined}
      data-feed-drop-target={canDragFeeds ? folder.id : undefined}
    >
      {showDropOverlay ? (
        <button
          type="button"
          aria-label={`Move to ${folder.name}`}
          data-feed-drop-kind="folder"
          data-feed-drop-target={folder.id}
          className="absolute inset-0 z-10 rounded-md"
          onClick={() => {
            onDropToFolder?.(folder.id);
          }}
        />
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Toggle folder ${folder.name}`}
          aria-expanded={folder.isExpanded}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/55 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
          onClick={() => onToggleFolder(folder.id)}
        >
          {folder.isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <SidebarNavButton
                aria-label={`Select folder ${folder.name}`}
                selected={folder.isSelected}
                trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
                data-feed-drop-kind={canDragFeeds ? "folder" : undefined}
                data-feed-drop-target={canDragFeeds ? folder.id : undefined}
                className={cn("flex-1", isActive && "border-dashed bg-sidebar-accent/60 ring-1 ring-sidebar-border")}
              />
            }
            onClick={() => onSelectFolder?.(folder.id)}
          >
            <span className="font-medium">{folder.name}</span>
          </ContextMenu.Trigger>
          {renderFolderContextMenu?.(folder)}
        </ContextMenu.Root>
      </div>
      {folder.isExpanded && (
        <div className="mt-1 ml-2 space-y-1 border-l border-sidebar-border/35 pl-3">
          {folder.feeds.map((feed) => (
            <FeedRow
              key={feed.id}
              feed={feed}
              displayFavicons={displayFavicons}
              onSelectFeed={onSelectFeed}
              renderFeedContextMenu={renderFeedContextMenu}
              canDragFeeds={canDragFeeds}
              isDragged={draggedFeedId === feed.id}
              onDragStartFeed={onDragStartFeed}
              onPointerDownFeed={onPointerDownFeed}
              consumeSuppressedHandleClick={consumeSuppressedHandleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedDragOverlayCard({ feed, displayFavicons }: { feed: FeedTreeFeedViewModel; displayFavicons: boolean }) {
  return (
    <div className="pointer-events-none min-w-48 rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5 text-sm text-sidebar-foreground shadow-lg">
      <div className="flex items-center gap-2">
        {displayFavicons ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.siteUrl} grayscale={feed.grayscaleFavicon} />
          </span>
        ) : null}
        <span className="truncate">{feed.title}</span>
      </div>
    </div>
  );
}

export function FeedTreeView({
  isOpen,
  folders,
  unfolderedFeeds,
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
  const [isPointerTracking, setIsPointerTracking] = useState(false);
  const [pointerDragPreview, setPointerDragPreview] = useState<PointerDragPreview | null>(null);
  const [pointerHoverTarget, setPointerHoverTarget] = useState<ActiveDropTarget>(null);
  const pointerDragRef = useRef<PointerDragSession | null>(null);
  const suppressHandleClickRef = useRef(false);
  const suppressHandleClickTimeoutRef = useRef<number | null>(null);
  const activeVisualDropTarget = isPointerTracking ? pointerHoverTarget : activeDropTarget;
  const activeUnfoldered = canDragFeeds && activeVisualDropTarget?.kind === "unfoldered";
  const showUnfolderedDropZone = canDragFeeds && (draggedFeedId !== null || pointerDragPreview !== null);

  const clearSuppressHandleClickTimer = useCallback(() => {
    if (suppressHandleClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressHandleClickTimeoutRef.current);
      suppressHandleClickTimeoutRef.current = null;
    }
  }, []);

  const clearPointerTracking = useCallback(() => {
    pointerDragRef.current = null;
    setIsPointerTracking(false);
    setPointerDragPreview(null);
    setPointerHoverTarget(null);
  }, []);

  const consumeSuppressedHandleClick = useCallback(() => suppressHandleClickRef.current, []);

  const queueSuppressHandleClickReset = useCallback(() => {
    clearSuppressHandleClickTimer();
    suppressHandleClickRef.current = true;
    suppressHandleClickTimeoutRef.current = window.setTimeout(() => {
      suppressHandleClickRef.current = false;
      suppressHandleClickTimeoutRef.current = null;
    }, 0);
  }, [clearSuppressHandleClickTimer]);

  const getDropTargetAtPoint = useCallback((x: number, y: number): ActiveDropTarget => {
    if (typeof document.elementFromPoint !== "function") {
      return null;
    }
    return getDropTargetFromElement(document.elementFromPoint(x, y));
  }, []);

  const handlePointerDownFeed = useCallback(
    (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!canDragFeeds || event.button !== 0) {
        return;
      }
      pointerDragRef.current = {
        feed,
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        isDragging: false,
        hoverTarget: null,
      };
      setIsPointerTracking(true);
    },
    [canDragFeeds],
  );

  useEffect(() => {
    if (!isOpen || !hasFeeds || !canDragFeeds) {
      clearPointerTracking();
    }
  }, [canDragFeeds, clearPointerTracking, hasFeeds, isOpen]);

  useEffect(() => {
    if (!isPointerTracking) {
      return;
    }

    const notifyHoverTarget = (target: ActiveDropTarget) => {
      setPointerHoverTarget(target);
      if (target?.kind === "folder") {
        onDragEnterFolder?.(target.folderId);
      } else if (target?.kind === "unfoldered") {
        onDragEnterUnfoldered?.();
      }
    };

    const finishPointerDrag = (target: ActiveDropTarget, shouldCancel: boolean) => {
      const session = pointerDragRef.current;
      if (!session) {
        clearPointerTracking();
        return;
      }

      if (!session.isDragging) {
        clearPointerTracking();
        return;
      }

      queueSuppressHandleClickReset();
      if (shouldCancel) {
        onDragEnd?.();
        clearPointerTracking();
        return;
      }

      if (target?.kind === "folder") {
        onDropToFolder?.(target.folderId);
      } else if (target?.kind === "unfoldered") {
        onDropToUnfoldered?.();
      } else {
        onDragEnd?.();
      }
      clearPointerTracking();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      session.currentX = event.clientX;
      session.currentY = event.clientY;

      if (!session.isDragging) {
        const distance = Math.hypot(event.clientX - session.originX, event.clientY - session.originY);
        if (distance < POINTER_DRAG_THRESHOLD) {
          return;
        }

        session.isDragging = true;
        onDragStartFeed?.(session.feed);
      }

      const hoverTarget = getDropTargetAtPoint(event.clientX, event.clientY);
      if (!isSameDropTarget(session.hoverTarget, hoverTarget)) {
        session.hoverTarget = hoverTarget;
        notifyHoverTarget(hoverTarget);
      }

      setPointerDragPreview({
        feed: session.feed,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      finishPointerDrag(getDropTargetAtPoint(event.clientX, event.clientY), false);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const session = pointerDragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      finishPointerDrag(null, true);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !pointerDragRef.current) {
        return;
      }
      finishPointerDrag(null, true);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    clearPointerTracking,
    getDropTargetAtPoint,
    isPointerTracking,
    onDragEnd,
    onDragEnterFolder,
    onDragEnterUnfoldered,
    onDragStartFeed,
    onDropToFolder,
    onDropToUnfoldered,
    queueSuppressHandleClickReset,
  ]);

  useEffect(() => {
    return () => {
      clearSuppressHandleClickTimer();
    };
  }, [clearSuppressHandleClickTimer]);

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
          <FolderSection
            key={folder.id}
            folder={folder}
            activeDropTarget={activeVisualDropTarget}
            draggedFeedId={draggedFeedId}
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
          <div className="space-y-1">
            {unfolderedFeeds.map((feed) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                displayFavicons={displayFavicons}
                onSelectFeed={onSelectFeed}
                renderFeedContextMenu={renderFeedContextMenu}
                canDragFeeds={canDragFeeds}
                isDragged={draggedFeedId === feed.id}
                onDragStartFeed={onDragStartFeed}
                onPointerDownFeed={handlePointerDownFeed}
                consumeSuppressedHandleClick={consumeSuppressedHandleClick}
              />
            ))}
          </div>
        )}
      </div>
      {pointerDragPreview ? (
        <div
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{
            transform: `translate3d(${pointerDragPreview.x + 12}px, ${pointerDragPreview.y + 12}px, 0)`,
          }}
        >
          <FeedDragOverlayCard feed={pointerDragPreview.feed} displayFavicons={displayFavicons} />
        </div>
      ) : null}
    </>
  );
}
