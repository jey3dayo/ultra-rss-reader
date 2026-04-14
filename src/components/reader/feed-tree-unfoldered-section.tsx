import { cn } from "@/lib/utils";
import type { FeedTreeUnfolderedSectionProps } from "./feed-tree.types";
import { FeedTreeRow } from "./feed-tree-row";
import { getSidebarDensityTokens } from "./sidebar-density";

export function FeedTreeUnfolderedSection({
  sidebarDensity = "normal",
  unfolderedFeeds,
  unfolderedLabel,
  onSelectFeed,
  displayFavicons,
  renderFeedContextMenu,
  canDragFeeds,
  normalizedDraggedFeedId,
  onDragStartFeed,
  onPointerDownFeed,
  consumeSuppressedHandleClick,
}: FeedTreeUnfolderedSectionProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);

  if (unfolderedFeeds.length === 0) {
    return null;
  }

  return (
    <div className={tokens.unfolderedGap}>
      {unfolderedLabel ? (
        <div className="ml-2 px-3 text-[0.68rem] font-medium tracking-[0.08em] text-sidebar-foreground/32 uppercase">
          {unfolderedLabel}
        </div>
      ) : null}
      <div className={cn("ml-2 border-l border-sidebar-border/25 pl-3", tokens.childGap)}>
        {unfolderedFeeds.map((feed) => (
          <FeedTreeRow
            key={feed.id}
            sidebarDensity={sidebarDensity}
            feed={feed}
            displayFavicons={displayFavicons}
            onSelectFeed={onSelectFeed}
            renderFeedContextMenu={renderFeedContextMenu}
            canDragFeeds={canDragFeeds}
            isDragged={normalizedDraggedFeedId === feed.id}
            onDragStartFeed={onDragStartFeed}
            onPointerDownFeed={onPointerDownFeed}
            consumeSuppressedHandleClick={consumeSuppressedHandleClick}
          />
        ))}
      </div>
    </div>
  );
}
