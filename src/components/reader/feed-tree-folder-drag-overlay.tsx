import { Folder } from "lucide-react";
import type { FolderTreeDragOverlayPreview } from "@/components/reader/hooks/feed-tree/folder-tree-drag.types";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";

type FeedTreeFolderDragOverlayProps = {
  preview: FolderTreeDragOverlayPreview;
  displayFavicons: boolean;
};

export function FeedTreeFolderDragOverlay({ preview, displayFavicons }: FeedTreeFolderDragOverlayProps) {
  return (
    <div
      data-testid="feed-tree-folder-drag-overlay"
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{
        transform: `translate3d(${preview.x + 12}px, ${preview.y + 12}px, 0)`,
      }}
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
