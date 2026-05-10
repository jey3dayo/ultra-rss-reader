import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import type { ActiveDropTarget, FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { FEED_DROP_TARGET_ID_ATTRIBUTE, FEED_DROP_TARGET_KIND_ATTRIBUTE } from "./feed-tree-drop-target";
import { FeedTreeRow } from "./feed-tree-row";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";
import { SidebarLeadingControlButton } from "./sidebar-leading-control-button";
import { SidebarNavButton } from "./sidebar-nav-button";

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
  const showDropOverlay = canDragFeeds && draggedFeedId !== null;
  const isActive = canDragFeeds && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;
  const panelId = `feed-tree-folder-panel-${folder.id}`;
  const handleMiddleMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (folder.unreadCount <= 0) {
      return;
    }
    onMarkFolderRead?.(folder);
  };

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
            className="pointer-events-none absolute inset-y-1.5 left-0 z-0 w-0.5 rounded-full bg-primary/85 transition-[opacity,transform,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          />
        ) : null}
        <SidebarLeadingControlButton
          aria-label={t("toggle_folder", {
            defaultValue: "Toggle folder {{name}}",
            name: folder.name,
          })}
          aria-expanded={folder.isExpanded}
          aria-controls={panelId}
          density={sidebarDensity}
          className={cn(
            "motion-disclosure-trigger -mr-1 text-foreground-soft hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground",
          )}
          onClick={() => onToggleFolder(folder.id)}
        >
          <ChevronDown
            className={cn("motion-disclosure-icon h-3 w-3", folder.isExpanded ? "rotate-0" : "-rotate-90")}
          />
        </SidebarLeadingControlButton>
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <SidebarNavButton
                density={sidebarDensity}
                aria-label={t("select_folder", {
                  defaultValue: "Select folder {{name}}",
                  name: folder.name,
                })}
                selected={folder.isSelected}
                selectedIndicatorMode="hidden"
                trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
                trailingClassName="text-[0.72rem] text-sidebar-foreground/54"
                {...(folder.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                {...(canDragFeeds
                  ? {
                      [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
                      [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
                    }
                  : {})}
                className={cn(
                  "flex-1 rounded-lg px-0.5 pl-1.5",
                  isActive && "border-dashed bg-[var(--feed-tree-drop-target-surface)] ring-1 ring-sidebar-border",
                )}
              />
            }
            onClick={() => onSelectFolder?.(folder.id)}
            onMouseDown={handleMiddleMouseDown}
          >
            <span className="font-medium tracking-[-0.01em]">{folder.name}</span>
          </ContextMenu.Trigger>
          {renderFolderContextMenu?.(folder)}
        </ContextMenu.Root>
      </div>
      <div
        id={panelId}
        data-state={folder.isExpanded ? "open" : "closed"}
        aria-hidden={folder.isExpanded ? "false" : "true"}
        className="motion-disclosure-panel"
      >
        <div className="motion-disclosure-body">
          <div
            className={cn("mt-0.5 border-l border-[var(--feed-tree-rail-border)]", tokens.treeInset, tokens.childGap)}
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
