import { computeTranslateX, isPaneVisible, resolveLayout } from "../hooks/use-layout";
import { cn } from "../lib/utils";
import { useUiStore } from "../stores/ui-store";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
}) {
  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div className="h-full overflow-hidden">
      <div
        className={cn(
          "flex h-full transition-transform duration-300 ease-in-out motion-reduce:duration-0",
          isMobile ? "w-[300%]" : "w-[calc(100%+280px)]",
        )}
        style={{ transform: `translateX(${translateX})` }}
      >
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "w-[280px] shrink-0")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "sidebar")}
          {...(!isPaneVisible(layoutMode, focusedPane, "sidebar") ? { inert: true } : {})}
        >
          <Sidebar />
        </div>
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "w-[380px] shrink-0")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "list")}
          {...(!isPaneVisible(layoutMode, focusedPane, "list") ? { inert: true } : {})}
        >
          <ArticleList />
        </div>
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "min-w-0 flex-1")}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "content")}
          {...(!isPaneVisible(layoutMode, focusedPane, "content") ? { inert: true } : {})}
        >
          <ArticleView />
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { layoutMode, focusedPane, contentMode } = useUiStore();

  if (layoutMode === "wide") {
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

  return <SlidingPaneLayout layoutMode={layoutMode} focusedPane={focusedPane} />;
}
