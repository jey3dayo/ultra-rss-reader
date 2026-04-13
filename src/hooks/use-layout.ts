export type Pane = "sidebar" | "list" | "content";
export type ResponsiveLayoutMode = "wide" | "compact" | "mobile";
type SlidingLayoutMode = "compact" | "mobile";
type FocusedPane = "sidebar" | "list" | "content";
const MOBILE_LAYOUT_BREAKPOINT = 640;
const COMPACT_LAYOUT_BREAKPOINT = 1100;

export function resolveResponsiveLayoutMode(
  preferredLayoutMode: "wide" | "compact",
  viewportWidth: number,
): ResponsiveLayoutMode {
  if (viewportWidth < MOBILE_LAYOUT_BREAKPOINT) {
    return "mobile";
  }
  if (viewportWidth < COMPACT_LAYOUT_BREAKPOINT) {
    return "compact";
  }
  return preferredLayoutMode;
}

export function resolveLayout(
  layoutMode: "wide" | "compact" | "mobile",
  focusedPane: FocusedPane,
  _contentMode: string,
): Pane[] {
  if (layoutMode === "wide") {
    return ["sidebar", "list", "content"];
  }
  if (layoutMode === "compact") {
    return focusedPane === "content" ? ["list", "content"] : ["sidebar", "list"];
  }
  return [focusedPane];
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
        return "calc(-100% / 3)";
      case "content":
        return "calc(-200% / 3)";
    }
  }
  return focusedPane === "content" ? "-280px" : "0px";
}
