import type { ApplyFeedTreeHoverTargetParams } from "./feed-tree.types";

export function applyFeedTreeHoverTarget({
  target,
  setPointerHoverTarget,
  onDragEnterFolder,
  onDragEnterUnfoldered,
}: ApplyFeedTreeHoverTargetParams) {
  setPointerHoverTarget(target);

  if (target?.kind === "folder") {
    onDragEnterFolder?.(target.folderId);
  } else if (target?.kind === "unfoldered") {
    onDragEnterUnfoldered?.();
  }
}
