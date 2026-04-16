import { ContextMenu } from "@base-ui/react/context-menu";
import { GripVertical } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { cn } from "@/lib/utils";
import type { FeedTreeDragHandleProps, FeedTreeRowProps } from "./feed-tree.types";
import { getSidebarDensityTokens } from "./sidebar-density";
import { SidebarLeadingControlButton } from "./sidebar-leading-control-button";
import { SidebarNavButton } from "./sidebar-nav-button";

export type { FeedTreeFeedViewModel, FeedTreeRowProps } from "./feed-tree.types";

function DragHandle({
  feedTitle,
  sidebarDensity = "normal",
  canDragFeeds,
  isArmed,
  onArm,
  onPointerDown,
  consumeSuppressedClick,
}: FeedTreeDragHandleProps) {
  const { t } = useTranslation("sidebar");

  if (!canDragFeeds) {
    return null;
  }

  return (
    <SidebarLeadingControlButton
      aria-label={t("drag_feed", { name: feedTitle })}
      density={sidebarDensity}
      visibleMode="on-row-hover"
      onPointerDown={onPointerDown}
      onClick={() => {
        if (consumeSuppressedClick?.()) {
          return;
        }
        onArm?.();
      }}
      className={cn(
        "cursor-grab text-sidebar-foreground/40 hover:bg-sidebar-accent/28 hover:text-foreground active:cursor-grabbing",
        isArmed && "bg-sidebar-accent/32 text-foreground opacity-100",
      )}
    >
      <GripVertical className="h-3 w-3" aria-hidden="true" />
    </SidebarLeadingControlButton>
  );
}

export function FeedTreeRow({
  sidebarDensity = "normal",
  feed,
  displayFavicons,
  onSelectFeed,
  renderFeedContextMenu,
  canDragFeeds,
  isDragged = false,
  onDragStartFeed,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: FeedTreeRowProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const rowStyle = {
    "--feed-tree-rail-offset": tokens.treeRailOffset,
  } as CSSProperties;

  return (
    <div
      className={cn("group/feed-row relative", isDragged && "opacity-70")}
      data-feed-row-id={feed.id}
      style={rowStyle}
    >
      {feed.isSelected ? (
        <span
          aria-hidden="true"
          data-feed-row-selected-indicator={feed.id}
          className={cn(
            "pointer-events-none absolute inset-y-1.5 left-[var(--feed-tree-rail-offset)] z-0 w-0.5 rounded-full bg-primary/85 transition-opacity duration-150",
            canDragFeeds && "group-hover/feed-row:opacity-0 group-focus-within/feed-row:opacity-0",
          )}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-y-0 left-[var(--feed-tree-rail-offset)] z-10 flex -translate-x-1/2 items-center"
        data-feed-row-handle-anchor={feed.id}
      >
        <div className="pointer-events-auto">
          <DragHandle
            feedTitle={feed.title}
            sidebarDensity={sidebarDensity}
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
              density={sidebarDensity}
              selected={feed.isSelected}
              selectedIndicatorMode={canDragFeeds ? "hidden" : "always"}
              trailing={feed.unreadCount > 0 ? feed.unreadCount.toLocaleString() : undefined}
              trailingClassName={
                feed.isSelected
                  ? "text-[var(--sidebar-selection-muted)]"
                  : "text-[var(--sidebar-foreground-muted-strong)]"
              }
              data-feed-id={feed.id}
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
