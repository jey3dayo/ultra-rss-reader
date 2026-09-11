import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedTreePresenceFeedViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeRow } from "@/components/reader/feed-tree-row";
import { FeedTreeRowCollapse } from "@/components/reader/feed-tree-row-collapse";
import { getSidebarDensityTokens, type SidebarDensity } from "@/components/reader/sidebar-density";
import { MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME } from "@/constants";

const GLOBAL_CSS_SOURCE = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");
const FEED_TREE_SELECTABLE_ROW_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/reader/feed-tree-selectable-row.tsx"),
  "utf8",
);

const ALL_SIDEBAR_DENSITIES: SidebarDensity[] = ["compact", "normal", "spacious"];

// Tailwind's default spacing scale (unconfirmed as overridden below) maps a
// `size-N` utility to `N * 0.25rem`. Parses "-0.5rem" -> -0.5 and "size-9" ->
// 2.25, so callers can do arithmetic on the same tokens sidebar-density.ts
// hands to the rest of the app, instead of re-typing the numbers by hand.
function parseRemToken(token: string): number {
  const remMatch = token.match(/(-?\d+(?:\.\d+)?)rem/);
  if (remMatch) {
    return Number.parseFloat(remMatch[1]);
  }
  const sizeMatch = token.match(/size-(\d+(?:\.\d+)?)/);
  if (sizeMatch) {
    return Number.parseFloat(sizeMatch[1]) * 0.25;
  }
  throw new Error(`unrecognized sidebar-density token: ${token}`);
}

const baseFeed: FeedTreePresenceFeedViewModel = {
  id: "feed-1",
  accountId: "acc-1",
  folderId: "folder-1",
  title: "Alpha",
  url: "https://example.com/alpha.xml",
  siteUrl: "https://example.com/alpha",
  unreadCount: 4,
  readerMode: "on",
  webPreviewMode: "off",
  isSelected: true,
  grayscaleFavicon: false,
  isLeaving: false,
};

describe("feed tree row collapse layout (PR #302 clipping + spacing fix)", () => {
  it("applies the collapse class at rest, not only while leaving", () => {
    // Required by motion-exit-animation.md: the class carrying the resting
    // transition-from value must be present before a row ever starts
    // leaving, or the leaving state has nothing to interpolate from.
    const { container } = render(
      <FeedTreeRowCollapse collapsing={false}>
        <div>row content</div>
      </FeedTreeRowCollapse>,
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass(MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME);
    expect(wrapper).not.toHaveAttribute("data-motion-sidebar-row-leaving");
  });

  it("keeps both left-overhanging rail decorations as descendants of the clipped box, relying on clip-path rather than DOM escape", () => {
    // This fix does not move the selection indicator / drag-handle anchor
    // out of the clipped grid item (feed-tree-row-collapse.tsx only wraps
    // `children` generically and cannot special-case them). Instead
    // global.css clips with `clip-path: inset(...)` instead of
    // `overflow: hidden`, expanding the clip region left far enough to
    // cover the *further* of the two decorations without moving either of
    // them. Fix this DOM-structure assertion and the derivation test below
    // together if the design changes.
    const { container } = render(
      <FeedTreeRowCollapse collapsing={false}>
        <FeedTreeRow
          feed={baseFeed}
          displayFavicons={false}
          onSelectFeed={vi.fn()}
          canDragFeeds={true}
          onDragStartFeed={vi.fn()}
          onPointerDownFeed={vi.fn()}
          consumeSuppressedHandleClick={() => false}
        />
      </FeedTreeRowCollapse>,
    );

    const collapseWrapper = container.querySelector(`.${MOTION_SIDEBAR_ROW_COLLAPSE_CLASS_NAME}`);
    const selectedIndicator = container.querySelector("[data-feed-row-selected-indicator='feed-1']");
    const handleAnchor = container.querySelector("[data-feed-row-handle-anchor='feed-1']");

    expect(collapseWrapper).not.toBeNull();
    expect(selectedIndicator).not.toBeNull();
    expect(handleAnchor).not.toBeNull();
    // They stay nested inside the collapse wrapper (jsdom does not compute
    // clip-path or layout, so the escape from clipping is verified as a
    // CSS/arithmetic contract below, not as DOM position here — the real
    // overhang in pixels was confirmed against a browser measurement, see
    // the derivation test).
    expect(collapseWrapper?.contains(selectedIndicator)).toBe(true);
    expect(collapseWrapper?.contains(handleAnchor)).toBe(true);
    // Their own left offset is unchanged: the clip fix must not require
    // moving or renumbering either decoration's own position.
    expect(selectedIndicator).toHaveClass("left-[var(--feed-tree-rail-offset)]");
    expect(handleAnchor).toHaveClass("left-[var(--feed-tree-rail-offset)]");
    // -translate-x-1/2 is what makes the handle anchor the *further*-left of
    // the two (it shifts left by an extra half of its own width beyond the
    // rail offset the indicator alone uses) — pinned so a future change that
    // drops this translate without revisiting the clip derivation is caught.
    expect(handleAnchor).toHaveClass("-translate-x-1/2");
  });

  it("enumerates every left-overhanging rail decoration exactly once, so a new one can't silently under-clip", () => {
    // PR #302's first pass covered only the selection indicator's overhang
    // and missed the drag handle's larger one (confirmed by browser
    // measurement: normal density clip box left edge 43px, indicator left
    // edge 35px [covered], handle anchor left edge 17px [26px left
    // uncovered by the first pass's inset]). Both `left-[var(--feed-tree-
    // rail-offset)]` occurrences in feed-tree-selectable-row.tsx are the
    // full known set of left-overhanging decorations today: the indicator
    // and the handle anchor. If a third one is ever added here, this count
    // must be bumped *and* the clip-path derivation in global.css
    // (`.motion-sidebar-row-collapse > *`) must be re-checked against it.
    const leftOffsetOccurrences = FEED_TREE_SELECTABLE_ROW_SOURCE.match(/left-\[var\(--feed-tree-rail-offset\)\]/g);
    expect(leftOffsetOccurrences).toHaveLength(2);
  });

  it("clips the collapse item's direct child with clip-path far enough left to cover the drag handle, not just the indicator, instead of overflow: hidden", () => {
    // overflow-x: visible + overflow-y: hidden is not usable here: per the
    // CSS Overflow spec, pairing `visible` on one axis with a non-visible
    // value on the other computes the `visible` axis to `auto`, which
    // would still hide both decorations (scrolled out of view). clip-path
    // clips independently of overflow and accepts a negative inset to
    // expand the clip region past that edge, so the rail is covered
    // without clipping being disabled anywhere.
    expect(GLOBAL_CSS_SOURCE).not.toMatch(/\.motion-sidebar-row-collapse > \*\s*\{[^}]*overflow:\s*hidden/);

    // Pin the exact formula so a numeric drift in it (not just in
    // sidebar-density.ts) is caught directly.
    const clipPathFormula = "clip-path: inset(0 0 0 calc(var(--feed-tree-rail-offset, 0px) * 3.25));";
    expect(GLOBAL_CSS_SOURCE).toContain(clipPathFormula);
    const multiplierMatch = GLOBAL_CSS_SOURCE.match(
      /clip-path:\s*inset\(0 0 0 calc\(var\(--feed-tree-rail-offset, 0px\) \* ([\d.]+)\)\);/,
    );
    expect(multiplierMatch).not.toBeNull();
    const multiplier = Number.parseFloat(multiplierMatch?.[1] ?? "NaN");

    // sidebar-density.ts's `--spacing` scale is assumed to be Tailwind's
    // default 0.25rem/unit when parsing `size-N` tokens below (parseRemToken).
    // If global.css ever defines a `--spacing` override, that assumption no
    // longer holds and this whole derivation must be re-verified.
    expect(GLOBAL_CSS_SOURCE).not.toMatch(/--spacing:\s*[\d.]/);

    // For every sidebar density, the drag-handle anchor's real left edge is
    // railOffset - controlWidth / 2 (railOffset itself, plus -translate-x-1/2
    // shifting it an extra half of its own rendered width further left). The
    // indicator alone only needs railOffset, which is always less negative
    // (closer to 0) than the handle's edge, so the handle is always the
    // binding constraint whenever a drag handle can render.
    for (const density of ALL_SIDEBAR_DENSITIES) {
      const tokens = getSidebarDensityTokens(density);
      const railOffset = parseRemToken(tokens.treeRailOffset);
      const controlWidth = parseRemToken(tokens.leadingControl);
      const requiredHandleEdge = railOffset - controlWidth / 2;
      const appliedInset = railOffset * multiplier;
      // The applied inset must reach at least as far left (be <= in value,
      // since both are negative rem numbers) as the handle's real edge.
      // Reaching further left than required is harmless (see the
      // derivation comment in global.css: clip-path only ever enlarges
      // this element's own paintable region, never a sibling's), so this
      // is an inequality, not an exact-match assertion.
      expect(appliedInset).toBeLessThanOrEqual(requiredHandleEdge);
    }

    // Folder rows never set --feed-tree-rail-offset, so the fallback 0px
    // must resolve to no extra clip inset at all (0 * multiplier === 0),
    // matching their existing box-edge selection indicator with no drag
    // handle at all.
    expect(0 * multiplier).toBe(0);
  });

  it("zeroes the space-y margin-block-end (not margin-top) on the leaving row", () => {
    // Tailwind 4's `space-y-*` utility sets `margin-block-end` on every
    // non-last sibling, not `margin-top`. Overriding `margin-top` here
    // left the real margin-block-end in place, so a leaving row in a
    // space-y-* list (e.g. spacious density) kept a residual gap below it
    // until the row unmounted.
    expect(GLOBAL_CSS_SOURCE).toContain('.motion-sidebar-row-collapse[data-motion-sidebar-row-leaving="true"]');
    const leavingRuleMatch = GLOBAL_CSS_SOURCE.match(
      /\.motion-sidebar-row-collapse\[data-motion-sidebar-row-leaving="true"\]\s*\{([^}]*)\}/,
    );
    expect(leavingRuleMatch).not.toBeNull();
    const leavingRuleBody = leavingRuleMatch?.[1] ?? "";
    expect(leavingRuleBody).toContain("margin-block-end: 0;");
    expect(leavingRuleBody).not.toMatch(/margin-top:/);
  });
});
