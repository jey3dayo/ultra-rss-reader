import { ChevronDown, Folder } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ContextMenu } from "@/design-system";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { FEED_DROP_TARGET_ID_ATTRIBUTE, FEED_DROP_TARGET_KIND_ATTRIBUTE } from "@/lib/sidebar/feed-tree-drop-target";
import { cn } from "@/lib/utils";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import type { ActiveDropTarget, FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { handleMiddleMouseMarkRead } from "./feed-tree-middle-click";
import { FeedTreeRow } from "./feed-tree-row";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";
import { SidebarNavButton } from "./sidebar-nav-button";

const folderParentRailClassName = "-ml-1 pl-0.5";
const folderChildRailClassName = "ml-[1.125rem] pl-3";

type FeedTreeFolderSectionProps = {
  sidebarDensity?: SidebarDensity;
  folder: FeedTreeFolderViewModel;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: (feed: FeedTreeFeedViewModel) => void;
  onMarkFolderRead?: (folder: FeedTreeFolderViewModel) => void;
  displayFavicons: boolean;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDropToFolder?: (folderId: string) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};

export function FeedTreeFolderSection({
  sidebarDensity = "normal",
  folder,
  activeDropTarget,
  draggedFeedId,
  onToggleFolder,
  onSelectFolder,
  onSelectFeed,
  onMarkFeedRead,
  onMarkFolderRead,
  displayFavicons,
  renderFolderContextMenu,
  renderFeedContextMenu,
  canDragFeeds,
  onDragStartFeed,
  onDropToFolder,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: FeedTreeFolderSectionProps) {
  const { t } = useTranslation("sidebar");
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } = useContextMenuTargetSnapshot(folder);
  const showDropOverlay = canDragFeeds && draggedFeedId !== null;
  const isActive = canDragFeeds && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;
  const panelId = `feed-tree-folder-panel-${folder.id}`;
  const handleMiddleMouseDown = (event: ReactMouseEvent<HTMLElement>) =>
    handleMiddleMouseMarkRead(event, folder, onMarkFolderRead);

  return (
    <div
      className={cn("relative rounded-md", isActive && "bg-[var(--feed-tree-active-folder-surface)]")}
      {...(canDragFeeds
        ? {
            [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
            [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
          }
        : {})}
    >
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
      <div className="relative flex items-center gap-0.5">
        {folder.isSelected ? (
          <span
            aria-hidden="true"
            data-folder-row-selected-indicator={folder.id}
            className="pointer-events-none absolute inset-y-1.5 left-0 z-0 w-0.5 rounded-full bg-primary/85 transition-[opacity,transform,background-color] duration-200 ease-standard motion-reduce:transition-none"
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
                trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
                trailingClassName="mr-1 text-[0.72rem] text-sidebar-foreground/54"
                {...(folder.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                {...(canDragFeeds
                  ? {
                      [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
                      [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
                    }
                  : {})}
                className={cn(
                  "flex-1 rounded-lg px-0.5",
                  folderParentRailClassName,
                  isActive && "border-dashed bg-[var(--feed-tree-drop-target-surface)] ring-1 ring-sidebar-border",
                )}
              />
            }
            onContextMenu={captureTarget}
            onKeyDownCapture={captureKeyboardTarget}
            onClick={() => {
              if (!folder.isExpanded) {
                onToggleFolder(folder.id);
              }
              onSelectFolder?.(folder.id);
            }}
            onMouseDown={handleMiddleMouseDown}
          >
            <span
              aria-hidden="true"
              className="motion-disclosure-trigger flex size-5 shrink-0 items-center justify-center text-foreground-soft"
            >
              <ChevronDown
                className={cn("motion-disclosure-icon h-3 w-3", folder.isExpanded ? "rotate-0" : "-rotate-90")}
              />
            </span>
            {displayFavicons ? (
              <span className="flex size-5 shrink-0 items-center justify-center text-sidebar-foreground/46">
                <Folder className="size-3.5" aria-hidden="true" />
              </span>
            ) : null}
            <span className="max-w-full truncate font-medium tracking-[-0.01em]" dir="auto" title={folder.name}>
              {folder.name}
            </span>
          </ContextMenu.Trigger>
          {renderFolderContextMenu?.(contextMenuTarget)}
        </ContextMenu.Root>
      </div>
      <div
        id={panelId}
        data-state={folder.isExpanded ? "open" : "closed"}
        aria-hidden={folder.isExpanded ? "false" : "true"}
        inert={folder.isExpanded ? undefined : true}
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
              <FeedTreeRow
                key={feed.id}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
