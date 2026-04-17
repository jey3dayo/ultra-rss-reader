import { FeedFavicon } from "@/components/shared/feed-favicon";
import type { FeedTreeFeedViewModel } from "./feed-tree.types";

export type FeedTreeDragOverlayPreview = {
  feed: FeedTreeFeedViewModel;
  x: number;
  y: number;
};

export type FeedTreeDragOverlayProps = {
  preview: FeedTreeDragOverlayPreview;
  displayFavicons: boolean;
};

export type FeedTreeDragOverlayCardProps = {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
};

function FeedTreeDragOverlayCard({ feed, displayFavicons }: FeedTreeDragOverlayCardProps) {
  return (
    <div className="pointer-events-none min-w-48 rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2 py-1.5 text-sm text-sidebar-foreground shadow-[var(--feed-tree-drag-overlay-shadow)]">
      <div className="flex items-center gap-2">
        {displayFavicons ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <FeedFavicon title={feed.title} url={feed.url} siteUrl={feed.siteUrl} grayscale={feed.grayscaleFavicon} />
          </span>
        ) : null}
        <span className="truncate">{feed.title}</span>
      </div>
    </div>
  );
}

export function FeedTreeDragOverlay({ preview, displayFavicons }: FeedTreeDragOverlayProps) {
  return (
    <div
      data-testid="feed-tree-drag-overlay"
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate3d(${preview.x + 12}px, ${preview.y + 12}px, 0)`,
      }}
    >
      <FeedTreeDragOverlayCard feed={preview.feed} displayFavicons={displayFavicons} />
    </div>
  );
}
