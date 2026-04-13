import type { FeedTreePointerDragSession } from "./feed-tree-drag-session";
import type { ActiveDropTarget } from "./feed-tree-folder-section";

export type FeedTreePointerDropOutcome =
  | { type: "clear" }
  | { type: "cancel" }
  | { type: "drop-folder"; folderId: string }
  | { type: "drop-unfoldered" }
  | { type: "drop-none" };

export function resolveFeedTreePointerDropOutcome(
  session: FeedTreePointerDragSession | null,
  target: ActiveDropTarget,
  shouldCancel: boolean,
): FeedTreePointerDropOutcome {
  if (!session?.isDragging) {
    return { type: "clear" };
  }

  if (shouldCancel) {
    return { type: "cancel" };
  }

  if (target?.kind === "folder") {
    return { type: "drop-folder", folderId: target.folderId };
  }

  if (target?.kind === "unfoldered") {
    return { type: "drop-unfoldered" };
  }

  return { type: "drop-none" };
}
