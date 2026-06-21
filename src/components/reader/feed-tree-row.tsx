import { GripVertical } from "lucide-react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { ContextMenu, FeedFavicon } from "@/design-system";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import type { FeedTreeRowProps } from "./feed-tree.types";
import { handleMiddleMouseMarkRead } from "./feed-tree-middle-click";
import { FeedTreeSelectableRow } from "./feed-tree-selectable-row";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";
import { SidebarLeadingControlButton } from "./sidebar-leading-control-button";
import { SidebarNavButton } from "./sidebar-nav-button";

export type { FeedTreeFeedViewModel, FeedTreeRowProps } from "./feed-tree.types";

type FeedTreeRowStyle = CSSProperties & Record<"--feed-tree-rail-offset", string>;

type FeedTreeDragHandleProps = {
  feedTitle: string;
  sidebarDensity?: SidebarDensity;
  canDragFeeds?: FeedTreeRowProps["canDragFeeds"];
  isArmed?: FeedTreeRowProps["isDragged"];
  onArm?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedClick?: FeedTreeRowProps["consumeSuppressedHandleClick"];
};

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
      aria-label={t("drag_feed", { defaultValue: "Drag {{name}}", name: feedTitle })}
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
        "cursor-grab text-sidebar-foreground/40 hover:bg-[var(--sidebar-hover-surface)] hover:text-foreground active:cursor-grabbing",
        isArmed && "bg-[var(--feed-tree-drop-target-surface)] text-foreground opacity-100",
      )}
    >
      <GripVertical className="size-3" aria-hidden="true" />
    </SidebarLeadingControlButton>
  );
}

export function FeedTreeRow({
  sidebarDensity = "normal",
  feed,
  displayFavicons,
  onSelectFeed,
  onMarkFeedRead,
  renderFeedContextMenu,
  canDragFeeds,
  isDragged = false,
  onDragStartFeed,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: FeedTreeRowProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } = useContextMenuTargetSnapshot(feed);
  const rowStyle: FeedTreeRowStyle = {
    "--feed-tree-rail-offset": tokens.treeRailOffset,
  };
  const handleMiddleMouseDown = (event: ReactMouseEvent<HTMLElement>) =>
    handleMiddleMouseMarkRead(event, feed, onMarkFeedRead);

  return (
    <FeedTreeSelectableRow
      rowClassName={cn("group/feed-row", isDragged && "opacity-70")}
      rowStyle={rowStyle}
      rowProps={{ "data-feed-row-id": feed.id }}
      selected={feed.isSelected}
      selectedIndicatorProps={{ "data-feed-row-selected-indicator": feed.id }}
      selectedIndicatorClassName={cn(canDragFeeds && "group-hover/feed-row:opacity-0")}
      leadingControl={
        <DragHandle
          feedTitle={feed.title}
          sidebarDensity={sidebarDensity}
          canDragFeeds={canDragFeeds}
          isArmed={isDragged}
          onArm={() => onDragStartFeed?.(feed)}
          onPointerDown={(event) => onPointerDownFeed?.(feed, event)}
          consumeSuppressedClick={consumeSuppressedHandleClick}
        />
      }
      leadingControlAnchorProps={{ "data-feed-row-handle-anchor": feed.id }}
    >
      <ContextMenu.Root onOpenChange={(open) => !open && clearTarget()}>
        <ContextMenu.Trigger
          render={
            <SidebarNavButton
              density={sidebarDensity}
              selected={feed.isSelected}
              selectedIndicatorMode={canDragFeeds ? "hidden" : "always"}
              trailing={feed.unreadCount > 0 ? feed.unreadCount.toLocaleString() : undefined}
              trailingClassName={
                feed.isSelected
                  ? "text-[0.72rem] text-[var(--sidebar-selection-muted)]"
                  : "text-[0.72rem] text-sidebar-foreground/52"
              }
              {...(feed.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
              data-feed-id={feed.id}
              className="rounded-lg"
            />
          }
          onContextMenu={captureTarget}
          onKeyDownCapture={captureKeyboardTarget}
          onClick={() => onSelectFeed(feed.id)}
          onMouseDown={handleMiddleMouseDown}
        >
          {displayFavicons && (
            <span className="flex size-5 shrink-0 items-center justify-center">
              <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.siteUrl} grayscale={feed.grayscaleFavicon} />
            </span>
          )}
          <span className="max-w-full truncate font-medium" dir="auto" title={feed.title}>
            {feed.title}
          </span>
        </ContextMenu.Trigger>
        {renderFeedContextMenu?.(contextMenuTarget)}
      </ContextMenu.Root>
    </FeedTreeSelectableRow>
  );
}
