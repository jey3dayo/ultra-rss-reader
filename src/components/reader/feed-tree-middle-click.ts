import type { MouseEvent as ReactMouseEvent } from "react";

type MarkableFeedTreeTarget = {
  unreadCount: number;
};

export function handleMiddleMouseMarkRead<TTarget extends MarkableFeedTreeTarget>(
  event: ReactMouseEvent<HTMLElement>,
  target: TTarget,
  onMarkRead: ((target: TTarget) => void) | undefined,
) {
  if (event.button !== 1) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (target.unreadCount <= 0) {
    return;
  }
  onMarkRead?.(target);
}
