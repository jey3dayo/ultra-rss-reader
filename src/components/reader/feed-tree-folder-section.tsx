import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FeedTreeFolderSectionProps } from "./feed-tree.types";
import { FEED_DROP_TARGET_ID_ATTRIBUTE, FEED_DROP_TARGET_KIND_ATTRIBUTE } from "./feed-tree-drop-target";
import { FeedTreeRow } from "./feed-tree-row";
import { getSidebarDensityTokens } from "./sidebar-density";
import { SidebarLeadingControlButton } from "./sidebar-leading-control-button";
import { SidebarNavButton } from "./sidebar-nav-button";

export function FeedTreeFolderSection({
  sidebarDensity = "normal",
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
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const showDropOverlay = canDragFeeds && draggedFeedId !== null;
  const isActive = canDragFeeds && activeDropTarget?.kind === "folder" && activeDropTarget.folderId === folder.id;
  const panelId = `feed-tree-folder-panel-${folder.id}`;

  return (
    <div
      className={cn("relative rounded-md", isActive && "bg-sidebar-accent/16")}
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
      <div className="relative flex items-center gap-0.5">
        {folder.isSelected ? (
          <span
            aria-hidden="true"
            data-folder-row-selected-indicator={folder.id}
            className="pointer-events-none absolute inset-y-1.5 left-0 z-0 w-0.5 rounded-full bg-primary/85"
          />
        ) : null}
        <SidebarLeadingControlButton
          aria-label={t("toggle_folder", { name: folder.name })}
          aria-expanded={folder.isExpanded}
          aria-controls={panelId}
          density={sidebarDensity}
          className={cn("-mr-1 text-foreground-soft hover:bg-sidebar-accent/28 hover:text-sidebar-foreground")}
          onClick={() => onToggleFolder(folder.id)}
        >
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              folder.isExpanded ? "rotate-0" : "-rotate-90",
            )}
          />
        </SidebarLeadingControlButton>
        <ContextMenu.Root>
          <ContextMenu.Trigger
            render={
              <SidebarNavButton
                density={sidebarDensity}
                aria-label={t("select_folder", { name: folder.name })}
                selected={folder.isSelected}
                selectedIndicatorMode="hidden"
                trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
                trailingClassName="text-foreground-soft"
                {...(canDragFeeds
                  ? {
                      [FEED_DROP_TARGET_KIND_ATTRIBUTE]: "folder",
                      [FEED_DROP_TARGET_ID_ATTRIBUTE]: folder.id,
                    }
                  : {})}
                className={cn(
                  "flex-1 px-0.5 pl-1.5",
                  isActive && "border-dashed bg-sidebar-accent/32 ring-1 ring-sidebar-border",
                )}
              />
            }
            onClick={() => onSelectFolder?.(folder.id)}
          >
            <span className="font-medium">{folder.name}</span>
          </ContextMenu.Trigger>
          {renderFolderContextMenu?.(folder)}
        </ContextMenu.Root>
      </div>
      <div
        id={panelId}
        aria-hidden={folder.isExpanded ? "false" : "true"}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          folder.isExpanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            folder.isExpanded ? "translate-y-0" : "-translate-y-2",
          )}
        >
          <div className={cn("mt-0.5 border-l border-sidebar-border/30", tokens.treeInset, tokens.childGap)}>
            {folder.feeds.map((feed) => (
              <FeedTreeRow
                key={feed.id}
                sidebarDensity={sidebarDensity}
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
        </div>
      </div>
    </div>
  );
}
