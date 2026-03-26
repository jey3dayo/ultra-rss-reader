import { resolveLayout } from "../hooks/use-layout";
import { useUiStore } from "../stores/ui-store";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

export function AppLayout() {
  const { layoutMode, focusedPane, contentMode } = useUiStore();
  const panes = resolveLayout(layoutMode, focusedPane, contentMode);

  return (
    <div className="flex h-full overflow-hidden">
      {panes.includes("sidebar") && (
        <div className="w-[280px] shrink-0">
          <Sidebar />
        </div>
      )}
      {panes.includes("list") && (
        <div className="w-[380px] shrink-0">
          <ArticleList />
        </div>
      )}
      {panes.includes("content") && (
        <div className="min-w-0 flex-1">
          <ArticleView />
        </div>
      )}
    </div>
  );
}
