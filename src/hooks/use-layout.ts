export type Pane = "sidebar" | "list" | "content";

export function resolveLayout(
  layoutMode: "wide" | "compact" | "mobile",
  focusedPane: "sidebar" | "list" | "content",
  contentMode: string,
): Pane[] {
  if (layoutMode === "wide") {
    return contentMode === "browser" ? ["list", "content"] : ["sidebar", "list", "content"];
  }
  if (layoutMode === "compact") {
    return focusedPane === "content" ? ["list", "content"] : ["sidebar", "list"];
  }
  return [focusedPane];
}
