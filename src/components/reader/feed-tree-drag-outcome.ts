import type {
  ActiveDropTarget,
  ApplyFeedTreePointerDropOutcomeParams,
  FeedTreePointerDropOutcome,
} from "./feed-tree.types";
import type { FeedTreePointerDragSession } from "./feed-tree-drag-session";

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

export function applyFeedTreePointerDropOutcome({
  outcome,
  queueSuppressHandleClickReset,
  clearPointerTracking,
  onDragEnd,
  onDropToFolder,
  onDropToUnfoldered,
}: ApplyFeedTreePointerDropOutcomeParams) {
  if (outcome.type === "clear") {
    clearPointerTracking();
    return;
  }

  queueSuppressHandleClickReset();

  if (outcome.type === "cancel" || outcome.type === "drop-none") {
    onDragEnd?.();
  } else if (outcome.type === "drop-folder") {
    onDropToFolder?.(outcome.folderId);
  } else if (outcome.type === "drop-unfoldered") {
    onDropToUnfoldered?.();
  }

  clearPointerTracking();
}
