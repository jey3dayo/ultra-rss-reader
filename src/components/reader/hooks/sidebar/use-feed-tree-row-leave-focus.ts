import { type RefObject, useLayoutEffect, useRef } from "react";
import { focusSelectedSidebarTarget } from "@/lib/reader-focus";

/**
 * When a sidebar feed/folder row transitions into `useFeedTreePresence`'s
 * "leaving" state, move focus off it — but only if focus is currently
 * inside that row. Focus elsewhere (the article pane, a dialog, the
 * account switcher) must never be stolen just because some unrelated row
 * started leaving.
 *
 * Reuses `focusSelectedSidebarTarget()` (src/lib/reader-focus.ts) rather
 * than focusing an element directly: it already knows how to fall back to
 * the account switcher when no row is currently selected, which is exactly
 * what happens when the row that just left focus was also the (now-gone)
 * selected feed/folder.
 */
export function useFeedTreeRowLeaveFocus(rowRef: RefObject<HTMLElement | null>, isLeaving: boolean): void {
  const wasLeavingRef = useRef(isLeaving);

  useLayoutEffect(() => {
    const wasLeaving = wasLeavingRef.current;
    wasLeavingRef.current = isLeaving;

    if (!isLeaving || wasLeaving) {
      return;
    }

    const node = rowRef.current;
    if (!node || typeof document === "undefined") {
      return;
    }

    if (node === document.activeElement || node.contains(document.activeElement)) {
      focusSelectedSidebarTarget();
    }
  }, [isLeaving, rowRef]);
}
