import { Folder } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FolderTreeDragOverlayPreview } from "@/components/reader/hooks/feed-tree/folder-tree-drag.types";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";

type FeedTreeFolderDragOverlayProps = {
  preview: FolderTreeDragOverlayPreview;
  displayFavicons: boolean;
};

const OVERLAY_CURSOR_OFFSET_PX = 12;

function toOverlayTransform(x: number, y: number) {
  return `translate3d(${x + OVERLAY_CURSOR_OFFSET_PX}px, ${y + OVERLAY_CURSOR_OFFSET_PX}px, 0)`;
}

// The preview is set once when the drag starts; following the pointer is a direct DOM write so
// a pointer move does not re-render the whole feed tree.
export function FeedTreeFolderDragOverlay({ preview, displayFavicons }: FeedTreeFolderDragOverlayProps) {
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
      data-testid="feed-tree-folder-drag-overlay"
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{ transform: toOverlayTransform(preview.x, preview.y) }}
    >
      <div
        data-open
        className={`${MOTION_POPUP_SURFACE_CLASS_NAME} pointer-events-none min-w-48 rounded-md border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2 py-1.5 text-sm text-sidebar-foreground shadow-[var(--feed-tree-drag-overlay-shadow)]`}
        style={{ transformOrigin: "top left" }}
      >
        <div className="flex items-center gap-2">
          {displayFavicons ? (
            <span className="flex size-5 shrink-0 items-center justify-center text-sidebar-foreground/46">
              <Folder className="size-3.5" aria-hidden="true" />
            </span>
          ) : null}
          <span className="truncate font-medium">{preview.folder.name}</span>
        </div>
      </div>
    </div>
  );
}
