import { resolveLayout } from "../hooks/use-layout";
import { useUiStore } from "../stores/ui-store";
import { ContentPane } from "./content/ContentPane";
import { ListPane } from "./list/ListPane";
import { SidebarPane } from "./sidebar/SidebarPane";

export function AppLayout() {
  const { layoutMode, focusedPane, contentMode } = useUiStore();
  const panes = resolveLayout(layoutMode, focusedPane, contentMode);

  const gridCols = panes
    .map((p) => (p === "sidebar" ? "var(--sidebar-width)" : p === "list" ? "var(--list-width)" : "1fr"))
    .join(" ");

  return (
    <div style={{ display: "grid", gridTemplateColumns: gridCols, height: "100%", overflow: "hidden" }}>
      {panes.includes("sidebar") && <SidebarPane />}
      {panes.includes("list") && <ListPane />}
      {panes.includes("content") && <ContentPane />}
    </div>
  );
}
