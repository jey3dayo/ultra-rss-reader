import { useLayoutEffect } from "react";
import { hasOpenNestedEscapeLayer } from "@/lib/dom/top-layer";
import { isImeCommitKeyEvent } from "@/lib/keyboard/ime-key-event";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

function isSearchInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === "search";
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

// The list search field is the workspace's only type=search input; any other text entry keeps Escape for itself.
export function useSubscriptionsIndexEscape(
  hasOpenFeedDialog: boolean,
  closeSubscriptionsWorkspace: () => void,
  selectOpen = false,
  endBulkSelection?: { active: boolean; end: () => void },
  clearSearch?: { active: boolean; clear: () => void },
) {
  const endActiveBulkSelection = endBulkSelection?.active ? endBulkSelection.end : null;
  const clearActiveSearch = clearSearch?.active ? clearSearch.clear : null;

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
        (isTextEntryTarget(target) && !isSearchInput(target))
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (clearActiveSearch) {
        clearActiveSearch();
      } else if (endActiveBulkSelection) {
        endActiveBulkSelection();
      } else {
        closeSubscriptionsWorkspace();
      }
    });

    return bindWindowEvents([{ type: "keydown", listener: handleKeyDown }]);
  }, [clearActiveSearch, closeSubscriptionsWorkspace, endActiveBulkSelection, hasOpenFeedDialog, selectOpen]);
}
