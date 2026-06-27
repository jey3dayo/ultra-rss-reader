import {
  COMPACT_LAYOUT_BREAKPOINT_PX,
  MOBILE_LAYOUT_BREAKPOINT_PX,
  SIDEBAR_PANE_WIDTH_PX,
} from "@/constants/ui-layout";
import type { ContentMode, FocusedPane, LayoutMode } from "@/lib/layout/layout-state.types";

export type Pane = FocusedPane;
export type ResponsiveLayoutMode = LayoutMode;
export type PreferredLayoutMode = Extract<LayoutMode, "wide" | "compact">;
type SlidingLayoutMode = Extract<LayoutMode, "compact" | "mobile">;

export function resolveResponsiveLayoutMode(
  preferredLayoutMode: PreferredLayoutMode,
  viewportWidth: number,
): ResponsiveLayoutMode {
  if (viewportWidth < MOBILE_LAYOUT_BREAKPOINT_PX) {
    return "mobile";
  }
  if (viewportWidth < COMPACT_LAYOUT_BREAKPOINT_PX) {
    return "compact";
  }
  return preferredLayoutMode;
}

function shouldRenderCompactContentPane(focusedPane: FocusedPane, contentMode: ContentMode): boolean {
  if (contentMode === "empty") {
    return focusedPane === "content";
  }
  return focusedPane === "content";
}

export function resolveLayout(layoutMode: LayoutMode, focusedPane: FocusedPane, contentMode: ContentMode): Pane[] {
  if (layoutMode === "wide") {
    if (contentMode === "browser") {
      return ["list", "content"];
    }
    return ["sidebar", "list", "content"];
  }
  if (layoutMode === "compact") {
    return shouldRenderCompactContentPane(focusedPane, contentMode) ? ["list", "content"] : ["sidebar", "list"];
  }
  return [focusedPane];
}

export function resolveVisiblePane(
  layoutMode: ResponsiveLayoutMode,
  focusedPane: FocusedPane,
  selectedAccountId: string | null,
): FocusedPane {
  if (layoutMode !== "mobile") {
    return focusedPane;
  }
  if (focusedPane === "content") {
    return "content";
  }
  if (selectedAccountId === null) {
    return "sidebar";
  }
  return "list";
}

export function isPaneVisible(layoutMode: SlidingLayoutMode, focusedPane: FocusedPane, pane: Pane): boolean {
  if (layoutMode === "mobile") return focusedPane === pane;
  if (focusedPane === "content") return pane !== "sidebar";
  return pane !== "content";
}

export function computeTranslateX(layoutMode: SlidingLayoutMode, focusedPane: FocusedPane): string {
  if (layoutMode === "mobile") {
    switch (focusedPane) {
      case "sidebar":
        return "0%";
      case "list":
        return "-100%";
      case "content":
        return "-200%";
    }
  }
  return focusedPane === "content" ? `-${SIDEBAR_PANE_WIDTH_PX}px` : "0px";
}
