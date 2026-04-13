import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FeedTreeFolderSectionProps } from "./feed-tree.types";
import { FEED_DROP_TARGET_ID_ATTRIBUTE, FEED_DROP_TARGET_KIND_ATTRIBUTE } from "./feed-tree-drop-target";
import { FeedTreeRow } from "./feed-tree-row";
import { SidebarNavButton } from "./sidebar-nav-button";

export function FeedTreeFolderSection({
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
}: FeedTreeFolderSectionProps) {
  const { t } = useTranslation("sidebar");
  const showDropOverlay = canDragFeeds && draggedFeedId !== null;
  const isActive = canDragFeeds && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;

  return (
    <div
      className={cn("relative rounded-md", isActive && "bg-sidebar-accent/20")}
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
          aria-label={t("move_to_folder", { name: folder.name })}
          {...{
            [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
            [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
          }}
          className="absolute inset-0 z-10 rounded-md"
          onClick={() => {
            onDropToFolder?.(folder.id);
          }}
        />
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("toggle_folder", { name: folder.name })}
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
                aria-label={t("select_folder", { name: folder.name })}
                selected={folder.isSelected}
                trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
                trailingClassName={
                  folder.isSelected ? "text-sidebar-accent-foreground/72" : "text-sidebar-foreground/52"
                }
                {...(canDragFeeds
                  ? {
                      [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
                      [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
                    }
                  : {})}
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
        <div className="mt-1 ml-2 space-y-1 border-l border-sidebar-border/30 pl-3">
          {folder.feeds.map((feed) => (
            <FeedTreeRow
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
