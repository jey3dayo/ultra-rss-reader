import { useEffect, useRef } from "react";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { FeedFavicon } from "@/design-system";
import type { FeedTreeFeedViewModel } from "./feed-tree.types";

export type FeedTreeDragOverlayPreview = {
  feed: FeedTreeFeedViewModel;
  pointerId: number;
  x: number;
  y: number;
};

type FeedTreeDragOverlayProps = {
  preview: FeedTreeDragOverlayPreview;
  displayFavicons: boolean;
};

type FeedTreeDragOverlayCardProps = {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
};

const OVERLAY_CURSOR_OFFSET_PX = 12;

function toOverlayTransform(x: number, y: number) {
  return `translate3d(${x + OVERLAY_CURSOR_OFFSET_PX}px, ${y + OVERLAY_CURSOR_OFFSET_PX}px, 0)`;
}

function FeedTreeDragOverlayCard({ feed, displayFavicons }: FeedTreeDragOverlayCardProps) {
  return (
    <div
      data-open
      className={`${MOTION_POPUP_SURFACE_CLASS_NAME} pointer-events-none min-w-48 rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2 py-1.5 text-sm text-sidebar-foreground shadow-[var(--feed-tree-drag-overlay-shadow)]`}
      style={{ transformOrigin: "top left" }}
    >
      <div className="flex items-center gap-2">
        {displayFavicons ? (
          <span className="flex size-5 shrink-0 items-center justify-center">
            <FeedFavicon
              title={feed.title}
              url={feed.url}
              siteUrl={feed.siteUrl}
              iconUrl={feed.iconUrl}
              grayscale={feed.grayscaleFavicon}
            />
          </span>
        ) : null}
        <span className="truncate">{feed.title}</span>
      </div>
    </div>
  );
}

export function FeedTreeDragOverlay({ preview, displayFavicons }: FeedTreeDragOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const followPointer = (event: PointerEvent) => {
      if (event.pointerId === preview.pointerId && overlayRef.current) {
        overlayRef.current.style.transform = toOverlayTransform(event.clientX, event.clientY);
      }
    };
    window.addEventListener("pointermove", followPointer);
    return () => window.removeEventListener("pointermove", followPointer);
  }, [preview.pointerId]);

  return (
    <div
      ref={overlayRef}
      data-testid="feed-tree-drag-overlay"
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{ transform: toOverlayTransform(preview.x, preview.y) }}
    >
      <FeedTreeDragOverlayCard feed={preview.feed} displayFavicons={displayFavicons} />
    </div>
  );
}
