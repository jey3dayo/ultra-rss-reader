import { cn } from "cn";
import { ChevronDown, Folder } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ContextMenu } from "@/design-system/context-menu";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { FEED_MOVE_FOLDER_ROW_ATTRIBUTE } from "@/lib/sidebar/feed-move-animation";
import { FEED_DROP_TARGET_ID_ATTRIBUTE, FEED_DROP_TARGET_KIND_ATTRIBUTE } from "@/lib/sidebar/feed-tree-drop-target";
import {
  FOLDER_REORDER_FOLDER_ID_ATTRIBUTE,
  FOLDER_REORDER_TARGET_ATTRIBUTE,
} from "@/lib/sidebar/folder-tree-drop-target";
import { formatSidebarUnreadCount } from "@/lib/sidebar/format-sidebar-unread-count";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import type {
  ActiveDropTarget,
  FeedTreeFeedViewModel,
  FeedTreeFolderViewModel,
  FeedTreePresenceFolderViewModel,
} from "./feed-tree.types";
import { FeedTreeFolderInsertionLine } from "./feed-tree-folder-insertion-line";
import { handleMiddleMouseMarkRead } from "./feed-tree-middle-click";
import { FeedTreeRow } from "./feed-tree-row";
import { FeedTreeRowCollapse } from "./feed-tree-row-collapse";
import { useFeedTreeRowLeaveFocus } from "./hooks/sidebar/use-feed-tree-row-leave-focus";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";
import { SidebarNavButton } from "./sidebar-nav-button";

const folderParentRailClassName = "pl-0.5";
const folderChildRailClassName = "ml-[1.125rem] pl-3";

type FeedTreeFolderSectionProps = {
  sidebarDensity?: SidebarDensity;
  folder: FeedTreePresenceFolderViewModel;
  folderIndex?: number;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  draggedFolderId?: string | null;
  folderDragInsertionIndex?: number | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: (feed: FeedTreeFeedViewModel) => void;
  onMarkFolderRead?: (folder: FeedTreeFolderViewModel) => void;
  displayFavicons: boolean;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  canDragFolders?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDropToFolder?: (folderId: string) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerDownFolder?: (folder: FeedTreePresenceFolderViewModel, event: ReactPointerEvent<HTMLElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};

export function FeedTreeFolderSection({
  sidebarDensity = "normal",
  folder,
  folderIndex = 0,
  activeDropTarget,
  draggedFeedId,
  draggedFolderId,
  folderDragInsertionIndex,
  onToggleFolder,
  onSelectFolder,
  onSelectFeed,
  onMarkFeedRead,
  onMarkFolderRead,
  displayFavicons,
  renderFolderContextMenu,
  renderFeedContextMenu,
  canDragFeeds,
  canDragFolders,
  onDragStartFeed,
  onDropToFolder,
  onPointerDownFeed,
  onPointerDownFolder,
  consumeSuppressedHandleClick,
}: FeedTreeFolderSectionProps) {
  const { t } = useTranslation("sidebar");
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } = useContextMenuTargetSnapshot(folder);
  const isDropTarget = canDragFeeds && !folder.isLeaving && draggedFolderId == null;
  const showDropOverlay = isDropTarget && draggedFeedId !== null;
  const isFolderDragging = draggedFolderId === folder.id;
  const showInsertionLineBefore =
    folderDragInsertionIndex !== null &&
    folderDragInsertionIndex !== undefined &&
    folderDragInsertionIndex === folderIndex &&
    draggedFolderId !== null;
  const showInsertionLineAfter =
    folderDragInsertionIndex !== null &&
    folderDragInsertionIndex !== undefined &&
    folderDragInsertionIndex === folderIndex + 1 &&
    draggedFolderId !== null;
  const isActive = isDropTarget && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;
  const panelId = `feed-tree-folder-panel-${folder.id}`;
  const handleMiddleMouseDown = (event: ReactMouseEvent<HTMLElement>) =>
    handleMiddleMouseMarkRead(event, folder, onMarkFolderRead);
  const rowRef = useRef<HTMLDivElement>(null);
  useFeedTreeRowLeaveFocus(rowRef, folder.isLeaving);
  const isCurrentSelection = folder.isSelected && !folder.isLeaving;
  const unreadCountPresentation = folder.unreadCount > 0 ? formatSidebarUnreadCount(folder.unreadCount) : null;

  return (
    <div
      ref={rowRef}
      className={cn("relative rounded-md", isActive && "bg-[var(--feed-tree-active-folder-surface)]")}
      {...{
        [FOLDER_REORDER_TARGET_ATTRIBUTE]: canDragFolders && !folder.isLeaving ? "true" : undefined,
        [FOLDER_REORDER_FOLDER_ID_ATTRIBUTE]: folder.id,
      }}
      {...(isDropTarget
        ? {
            [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
            [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
          }
        : {})}
    >
      <FeedTreeFolderInsertionLine visible={showInsertionLineBefore} />
      {showDropOverlay ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("move_to_folder", {
            defaultValue: "Move to folder {{name}}",
            name: folder.name,
          })}
          {...{
            [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
            [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
          }}
          className="absolute inset-y-0 right-0 left-8 z-10 rounded-r-md"
          onClick={() => {
            onDropToFolder?.(folder.id);
          }}
        />
      ) : null}
      <div className="relative flex items-center gap-0.5" {...{ [FEED_MOVE_FOLDER_ROW_ATTRIBUTE]: folder.id }}>
        {folder.isSelected ? (
          <span
            aria-hidden="true"
            data-folder-row-selected-indicator={folder.id}
            className="pointer-events-none absolute inset-y-1.5 left-0 z-[1] w-0.5 rounded-full bg-primary/85 transition-[opacity,transform,background-color] duration-200 ease-standard motion-reduce:transition-none"
          />
        ) : null}
        <ContextMenu.Root onOpenChange={(open) => !open && clearTarget()}>
          <ContextMenu.Trigger
            render={
              <SidebarNavButton
                density={sidebarDensity}
                aria-label={t("select_folder", {
                  defaultValue: "Select folder {{name}}",
                  name: folder.name,
                })}
                aria-expanded={folder.isExpanded}
                aria-controls={panelId}
                selected={folder.isSelected}
                selectedIndicatorMode="hidden"
                registerSidebarNavigationTarget={!folder.isLeaving}
                trailing={unreadCountPresentation?.label}
                trailingTitle={unreadCountPresentation?.title}
                trailingKeepLastOnClear
                trailingClassName="text-[0.72rem] text-sidebar-foreground/54"
                {...(isCurrentSelection ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                {...(isDropTarget
                  ? {
                      [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
                      [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
                    }
                  : {})}
                // See feed-tree-row.tsx: a keyboard-issued `contextmenu` targets
                // whatever holds focus, so `pointer-events: none` alone does not
                // close that path. Leaving the tab order does, and the prop is
                // spread only while leaving so React does not own the attribute
                // at rest.
                {...(folder.isLeaving ? { tabIndex: -1 } : {})}
                className={cn(
                  "flex-1 rounded-lg pl-0.5",
                  folderParentRailClassName,
                  isActive && "border-dashed bg-[var(--feed-tree-drop-target-surface)] ring-1 ring-sidebar-border",
                  isFolderDragging && "opacity-55",
                  canDragFolders && !folder.isLeaving && "cursor-grab active:cursor-grabbing",
                )}
              />
            }
            onContextMenu={folder.isLeaving ? undefined : captureTarget}
            onKeyDownCapture={folder.isLeaving ? undefined : captureKeyboardTarget}
            onPointerDown={
              folder.isLeaving || !canDragFolders
                ? undefined
                : (event) => {
                    onPointerDownFolder?.(folder, event);
                  }
            }
            onClick={
              folder.isLeaving
                ? undefined
                : () => {
                    if (consumeSuppressedHandleClick?.()) {
                      return;
                    }
                    if (folder.isSelected && folder.isExpanded) {
                      onToggleFolder(folder.id);
                      return;
                    }
                    if (!folder.isExpanded) {
                      onToggleFolder(folder.id);
                    }
                    onSelectFolder?.(folder.id);
                  }
            }
            onMouseDown={folder.isLeaving ? undefined : handleMiddleMouseDown}
          >
            <span
              aria-hidden="true"
              className="motion-disclosure-trigger flex size-5 shrink-0 items-center justify-center text-sidebar-foreground/54"
            >
              <ChevronDown
                className={cn("motion-disclosure-icon size-3.5", folder.isExpanded ? "rotate-0" : "-rotate-90")}
              />
            </span>
            {displayFavicons ? (
              <span className="flex size-5 shrink-0 items-center justify-center text-sidebar-foreground/46">
                <Folder className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <span
              className="min-w-0 flex-1 truncate text-left font-medium tracking-[-0.01em]"
              dir="auto"
              title={folder.name}
            >
              {folder.name}
            </span>
          </ContextMenu.Trigger>
          {renderFolderContextMenu?.(contextMenuTarget)}
        </ContextMenu.Root>
      </div>
      <div
        id={panelId}
        data-state={folder.isExpanded && !isFolderDragging ? "open" : "closed"}
        aria-hidden={folder.isExpanded && !isFolderDragging ? "false" : "true"}
        inert={folder.isExpanded && !isFolderDragging ? undefined : true}
        className="motion-disclosure-panel"
      >
        <div className="motion-disclosure-body">
          <div
            className={cn(
              "mt-0.5 border-l border-[var(--feed-tree-rail-border)]",
              folderChildRailClassName,
              tokens.childGap,
            )}
          >
            {folder.feeds.map((feed) => (
              // The folder itself owns the collapse when it is leaving (its
              // whole subtree, children included, is already shrinking to
              // zero height); collapsing the child too here would collapse
              // it twice. Only this wrapper collapses when the child is
              // leaving on its own (folder not leaving).
              <FeedTreeRowCollapse key={feed.id} collapsing={feed.isLeaving && !folder.isLeaving}>
                <FeedTreeRow
                  sidebarDensity={sidebarDensity}
                  feed={feed}
                  displayFavicons={displayFavicons}
                  onSelectFeed={onSelectFeed}
                  onMarkFeedRead={onMarkFeedRead}
                  renderFeedContextMenu={renderFeedContextMenu}
                  canDragFeeds={canDragFeeds}
                  isDragged={draggedFeedId === feed.id}
                  onDragStartFeed={onDragStartFeed}
                  onPointerDownFeed={onPointerDownFeed}
                  consumeSuppressedHandleClick={consumeSuppressedHandleClick}
                />
              </FeedTreeRowCollapse>
            ))}
          </div>
        </div>
      </div>
      <FeedTreeFolderInsertionLine visible={showInsertionLineAfter} className="-bottom-px top-auto" />
    </div>
  );
}
