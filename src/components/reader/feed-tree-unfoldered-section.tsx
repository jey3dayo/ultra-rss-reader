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
        <div
          className={cn(
            "text-[0.68rem] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase",
            tokens.sectionLabelInset,
          )}
        >
          {unfolderedLabel}
        </div>
      ) : null}
      <div className={cn("border-l border-[var(--feed-tree-rail-border-soft)]", tokens.treeInset, tokens.childGap)}>
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
