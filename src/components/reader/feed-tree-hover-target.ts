import type { Dispatch, SetStateAction } from "react";
import type { ActiveDropTarget } from "./feed-tree-folder-section";

type ApplyFeedTreeHoverTargetParams = {
  target: ActiveDropTarget;
  setPointerHoverTarget: Dispatch<SetStateAction<ActiveDropTarget>>;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
};

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
