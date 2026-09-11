import { GripVertical } from "lucide-react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FeedFavicon } from "@/design-system";
import { ContextMenu } from "@/design-system/context-menu";
import { SIDEBAR_ROW_LEAVING_ATTRIBUTE, SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import type { FeedTreeRowProps } from "./feed-tree.types";
import { handleMiddleMouseMarkRead } from "./feed-tree-middle-click";
import { FeedTreeSelectableRow } from "./feed-tree-selectable-row";
import { useFeedTreeRowLeaveFocus } from "./hooks/sidebar/use-feed-tree-row-leave-focus";
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
  const rowRef = useRef<HTMLDivElement>(null);
  useFeedTreeRowLeaveFocus(rowRef, feed.isLeaving);
  const canDragThisFeed = canDragFeeds && !feed.isLeaving;
  const isCurrentSelection = feed.isSelected && !feed.isLeaving;

  return (
    <FeedTreeSelectableRow
      rowRef={rowRef}
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
          canDragFeeds={canDragThisFeed}
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
              registerSidebarNavigationTarget={!feed.isLeaving}
              trailing={feed.unreadCount > 0 ? feed.unreadCount.toLocaleString() : undefined}
              trailingKeepLastOnClear
              trailingClassName={
                feed.isSelected
                  ? "text-[0.72rem] text-[var(--sidebar-selection-muted)]"
                  : "text-[0.72rem] text-sidebar-foreground/52"
              }
              {...(isCurrentSelection ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
              // `pointer-events: none` on the collapse wrapper stops the pointer
              // paths into the context menu, but a keyboard-issued `contextmenu`
              // (Shift+F10, menu key) targets whatever holds focus. Dropping the
              // row out of the tab order is what closes that path: the leave
              // focus hook has already moved focus off the row, and this keeps it
              // from being focused again on the way out. `inert` would do all of
              // this at once, but React commits attributes before layout effects,
              // so it would blur to `body` before that hook could redirect focus.
              //
              // Spread only while leaving. Passing `tabIndex={undefined}` at rest
              // would put the attribute under React's control, and every re-render
              // would then strip the `tabindex="-1"` that the mobile layout sets
              // imperatively on the descendants of a hidden pane.
              {...(feed.isLeaving ? { tabIndex: -1 } : {})}
              // `data-feed-id` stays on the row unconditionally (existing DOM
              // tests locate leaving rows by it), so a scheduled sidebar-focus
              // frame (`use-sidebar-feed-navigation.ts`) can still find this
              // element by feed id after it starts leaving. This separate
              // marker is what that lookup checks to skip a dead, `tabIndex={-1}`
              // leaving row instead of focusing it. See
              // `.claude/rules/motion-exit-animation.md`.
              {...(feed.isLeaving ? { [SIDEBAR_ROW_LEAVING_ATTRIBUTE]: "true" } : {})}
              data-feed-id={feed.id}
              className="motion-list-item-enter rounded-lg"
            />
          }
          onContextMenu={feed.isLeaving ? undefined : captureTarget}
          onKeyDownCapture={feed.isLeaving ? undefined : captureKeyboardTarget}
          onClick={feed.isLeaving ? undefined : () => onSelectFeed(feed.id)}
          onMouseDown={feed.isLeaving ? undefined : handleMiddleMouseDown}
        >
          {displayFavicons && (
            <span className="flex size-5 shrink-0 items-center justify-center">
              <FeedFavicon
                title={feed.title}
                url={feed.url}
                siteUrl={feed.siteUrl}
                iconUrl={feed.iconUrl}
                grayscale={feed.grayscaleFavicon}
              />
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
