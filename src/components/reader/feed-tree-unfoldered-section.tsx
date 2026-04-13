import type { ReactNode } from "react";
import type { FeedTreeFeedViewModel } from "./feed-tree.types";
import { FeedTreeRow } from "./feed-tree-row";

type FeedTreeUnfolderedSectionProps = {
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds: boolean;
  normalizedDraggedFeedId: string | null;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed: (feed: FeedTreeFeedViewModel, event: React.PointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick: () => boolean;
};

export function FeedTreeUnfolderedSection({
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
  if (unfolderedFeeds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {unfolderedLabel ? (
        <div className="ml-2 px-3 text-[0.68rem] font-medium tracking-[0.08em] text-sidebar-foreground/32 uppercase">
          {unfolderedLabel}
        </div>
      ) : null}
      <div className="ml-2 space-y-1 border-l border-sidebar-border/25 pl-3">
        {unfolderedFeeds.map((feed) => (
          <FeedTreeRow
            key={feed.id}
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
