import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS } from "@/constants";
import { readMatchMedia, subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";

export type SidebarNavButtonTrailingOptions = {
  trailing: ReactNode;
  /**
   * Keeps rendering the last non-empty `trailing` value, fading it out
   * instead of unmounting it the instant `trailing` becomes empty (e.g. an
   * unread count dropping to 0). Opt-in: callers that rely on `trailing`
   * disappearing immediately (smart views, tag list, the account service
   * picker) must not set this.
   */
  keepLastOnClear: boolean;
};

export type SidebarNavButtonTrailingResult = {
  /** The value the caller should render: `trailing` itself, or the retained value while it fades out. */
  trailing: ReactNode;
  /** Whether `trailing` is currently the retained value rather than the live one. */
  isLeaving: boolean;
};

function isTrailingEmpty(trailing: ReactNode): boolean {
  return trailing === null || trailing === undefined;
}

/**
 * Owns the badge-retention lifecycle for `SidebarNavButton`'s `trailing` slot:
 * holds a cleared value visible for `MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS` so
 * it can fade out instead of unmounting instantly, then drops it so the row
 * reclaims the rail width. Honors `prefers-reduced-motion` by skipping the
 * hold entirely, including when reduced motion turns on mid-fade.
 */
export function useSidebarNavButtonTrailing({
  trailing,
  keepLastOnClear,
}: SidebarNavButtonTrailingOptions): SidebarNavButtonTrailingResult {
  const [lastTrailing, setLastTrailing] = useState<ReactNode>(trailing);

  // The effect's own dependency on `lastTrailing` re-runs it once the timer
  // clears that value, which the guard below turns into a no-op instead of
  // restarting the fade.
  useEffect(() => {
    if (!isTrailingEmpty(trailing)) {
      setLastTrailing(trailing);
      return;
    }

    if (!keepLastOnClear || isTrailingEmpty(lastTrailing)) {
      return;
    }

    const reducedMotionQuery = readMatchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotionQuery?.matches) {
      setLastTrailing(null);
      return;
    }

    let timeoutId: number | undefined = window.setTimeout(() => {
      timeoutId = undefined;
      setLastTrailing(null);
    }, MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS);

    // If reduced motion turns on mid-fade, the CSS token already jumps to 0ms;
    // cancel the timer and unmount right away instead of leaving the rail
    // width reserved for the rest of the duration.
    const unsubscribeReducedMotion = reducedMotionQuery
      ? subscribeMatchMediaChange(reducedMotionQuery, (event) => {
          if (!event.matches) {
            return;
          }
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          setLastTrailing(null);
        })
      : () => {};

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      unsubscribeReducedMotion();
    };
  }, [trailing, keepLastOnClear, lastTrailing]);

  const isLeaving = keepLastOnClear && isTrailingEmpty(trailing) && !isTrailingEmpty(lastTrailing);
  const resolvedTrailing = isLeaving ? lastTrailing : trailing;

  return { trailing: resolvedTrailing, isLeaving };
}
