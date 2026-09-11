import type { ReactNode, Ref } from "react";
import { MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE, MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME } from "@/constants";

type FeedTreeRowCollapseProps = {
  /**
   * Whether this wrapper currently owns the collapse for its child. Kept as
   * a prop (rather than only rendering the wrapper when `true`) so the
   * wrapper element itself is always present at a stable position in the
   * tree: toggling it in and out of existence would change the element type
   * React sees at that list position, forcing an unmount/remount of the row
   * underneath — which would both destroy any focus inside it and skip the
   * CSS transition entirely (a freshly mounted node has no prior style to
   * transition from).
   *
   * For the same reason this drives only the `data-*` attribute, never the
   * class: `.motion-sidebar-row-collapse` carries the resting
   * `grid-template-rows: 1fr` and the transition declaration, so it has to
   * be applied at rest. Adding the class at the same moment the row starts
   * leaving would change the track from `none` to `0fr` in one step, which
   * does not interpolate — the row would snap, which is the behavior this
   * whole wrapper exists to remove.
   */
  collapsing: boolean;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

/**
 * Wraps a single sidebar feed/folder row so it can collapse its occupied
 * height (grid-template-rows 1fr -> 0fr, see `.motion-sidebar-row-collapse`
 * in global.css) and fade out while `useFeedTreePresence` retains it as
 * "leaving", instead of the row disappearing abruptly.
 *
 * Always wrap every row with this component, and drive the collapsed look
 * with `collapsing`. Set it `true` for a row that is *itself* the collapse
 * owner for this transition. When a folder is leaving, only the folder's
 * own wrapper collapses — its still-rendered children must not also
 * collapse, or the height reduction double-counts (the folder's own
 * collapse already takes its entire subtree, children included, to zero
 * height). When a folder is not leaving but one of its children is, only
 * that child's wrapper collapses.
 */
export function FeedTreeRowCollapse({ collapsing, children, ref }: FeedTreeRowCollapseProps) {
  return (
    <div
      ref={ref}
      className={MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME}
      {...(collapsing ? { [MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE]: "true" } : {})}
    >
      {children}
    </div>
  );
}
