import { ContextMenu } from "@base-ui/react/context-menu";
import { GripVertical } from "lucide-react";
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
        "cursor-grab text-sidebar-foreground/40 hover:bg-sidebar-accent/40 hover:text-foreground active:cursor-grabbing",
        isArmed && "bg-sidebar-accent/60 text-foreground opacity-100",
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

  return (
    <div className={cn("group/feed-row relative", isDragged && "opacity-70")}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center">
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
              trailing={feed.unreadCount > 0 ? feed.unreadCount.toLocaleString() : undefined}
              trailingClassName={feed.isSelected ? "text-sidebar-accent-foreground/68" : "text-sidebar-foreground/38"}
              data-feed-id={feed.id}
              className={cn(canDragFeeds && tokens.dragPadding)}
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
