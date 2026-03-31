export type Pane = "sidebar" | "list" | "content";
export type ResponsiveLayoutMode = "wide" | "compact" | "mobile";
type SlidingLayoutMode = "compact" | "mobile";
type FocusedPane = "sidebar" | "list" | "content";

export function resolveResponsiveLayoutMode(
  preferredLayoutMode: "wide" | "compact",
  viewportWidth: number,
): ResponsiveLayoutMode {
  if (viewportWidth < 500) {
    return "mobile";
  }
  if (viewportWidth < 1100) {
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
        return "-100%";
      case "content":
        return "-200%";
    }
  }
  return focusedPane === "content" ? "-280px" : "0px";
}
