import { computeTranslateX, isPaneVisible, resolveLayout } from "../hooks/use-layout";
import { cn } from "../lib/utils";
import { type ContentMode, useUiStore } from "../stores/ui-store";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
  feedCleanupOpen,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  feedCleanupOpen: boolean;
}) {
  if (feedCleanupOpen) {
    return (
      <div className="h-full overflow-hidden">
        <ArticleView />
      </div>
    );
  }

  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div className="h-full overflow-hidden">
      <div
        data-testid="sliding-pane-tray"
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
  const layoutMode = useUiStore((state) => state.layoutMode);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const feedCleanupOpen = useUiStore((state) => state.feedCleanupOpen);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);

  return (
    // Keep layout flush to the top edge. macOS titlebar spacing lives in AppShell,
    // otherwise the visible header and the draggable titlebar band diverge again.
    <div className="relative h-full overflow-hidden">
      {layoutMode === "wide" ? (
        <WideLayout
          focusedPane={focusedPane}
          contentMode={contentMode}
          feedCleanupOpen={feedCleanupOpen}
          sidebarOpen={sidebarOpen}
        />
      ) : (
        <SlidingPaneLayout layoutMode={layoutMode} focusedPane={focusedPane} feedCleanupOpen={feedCleanupOpen} />
      )}
    </div>
  );
}

function WideLayout({
  focusedPane,
  contentMode,
  feedCleanupOpen,
  sidebarOpen,
}: {
  focusedPane: "sidebar" | "list" | "content";
  contentMode: ContentMode;
  feedCleanupOpen: boolean;
  sidebarOpen: boolean;
}) {
  const panes = feedCleanupOpen ? ["sidebar", "content"] : resolveLayout("wide", focusedPane, contentMode);
  const shouldShowSidebar = feedCleanupOpen || sidebarOpen;

  return (
    <div className="flex h-full overflow-hidden">
      {panes.includes("sidebar") && (
        <div
          data-testid="wide-sidebar-shell"
          className={cn(
            "shrink-0 overflow-hidden border-r transition-[width,opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            shouldShowSidebar
              ? "w-[280px] border-border opacity-100 translate-x-0"
              : "w-0 border-transparent opacity-0 -translate-x-3",
          )}
        >
          <div
            data-testid="wide-sidebar-content"
            className={cn("h-full w-[280px]", !shouldShowSidebar && "pointer-events-none")}
            aria-hidden={!shouldShowSidebar}
            {...(!shouldShowSidebar ? { inert: true } : {})}
          >
            <Sidebar />
          </div>
        </div>
      )}
      <div data-testid="main-stage" className="flex min-w-0 flex-1">
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
      {!panes.includes("list") && !panes.includes("content") && (
        <div className="min-w-0 flex-1">
          <ArticleView />
        </div>
      )}
    </div>
  );
}
