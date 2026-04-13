import { ContextMenu } from "@base-ui/react/context-menu";
import { GripVertical } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { cn } from "@/lib/utils";
import type { FeedTreeRowProps } from "./feed-tree.types";
import { SidebarNavButton } from "./sidebar-nav-button";

export type { FeedTreeFeedViewModel, FeedTreeRowProps } from "./feed-tree.types";

type DragHandleProps = {
  feedTitle: string;
  canDragFeeds?: boolean;
  isArmed?: boolean;
  onArm?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedClick?: () => boolean;
};

function DragHandle({
  feedTitle,
  canDragFeeds,
  isArmed,
  onArm,
  onPointerDown,
  consumeSuppressedClick,
}: DragHandleProps) {
  const { t } = useTranslation("sidebar");

  if (!canDragFeeds) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={t("drag_feed", { name: feedTitle })}
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

export function FeedTreeRow({
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
              trailingClassName={feed.isSelected ? "text-sidebar-accent-foreground/68" : "text-sidebar-foreground/38"}
              data-feed-id={feed.id}
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
