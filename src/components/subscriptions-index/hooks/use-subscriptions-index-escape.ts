import { useLayoutEffect } from "react";
import { isImeCommitKeyEvent } from "@/lib/keyboard/ime-key-event";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

function hasOpenNestedEscapeLayer(): boolean {
  return document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]') !== null;
}

export function useSubscriptionsIndexEscape(
  hasOpenFeedDialog: boolean,
  closeSubscriptionsWorkspace: () => void,
  selectOpen = false,
  endBulkSelection?: { active: boolean; end: () => void },
) {
  const endActiveBulkSelection = endBulkSelection?.active ? endBulkSelection.end : null;

  useLayoutEffect(() => {
    const handleKeyDown = createKeyboardEventListener((event) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        isImeCommitKeyEvent(event) ||
        event.key !== "Escape" ||
        hasOpenFeedDialog ||
        selectOpen ||
        hasOpenNestedEscapeLayer() ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (endActiveBulkSelection) {
        endActiveBulkSelection();
      } else {
        closeSubscriptionsWorkspace();
      }
    });

    return bindWindowEvents([{ type: "keydown", listener: handleKeyDown }]);
  }, [closeSubscriptionsWorkspace, endActiveBulkSelection, hasOpenFeedDialog, selectOpen]);
}
