import { computeTranslateX, isPaneVisible, resolveLayout } from "../hooks/use-layout";
import { cn } from "../lib/utils";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "../lib/window-chrome";
import { usePlatformStore } from "../stores/platform-store";
import { useUiStore } from "../stores/ui-store";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
  overlayTitlebar,
  feedCleanupOpen,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  overlayTitlebar: boolean;
  feedCleanupOpen: boolean;
}) {
  if (feedCleanupOpen) {
    return (
      <div
        className={cn("h-full overflow-hidden", overlayTitlebar && "desktop-titlebar-offset desktop-overlay-titlebar")}
      >
        <ArticleView />
      </div>
    );
  }

  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div
      className={cn(
        "h-full overflow-hidden",
        // macOS overlay titlebar 以外は上の空間は詰める。
        overlayTitlebar && "desktop-titlebar-offset desktop-overlay-titlebar",
      )}
    >
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
  const layoutMode = useUiStore((state) => state.layoutMode);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const feedCleanupOpen = useUiStore((state) => state.feedCleanupOpen);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  if (layoutMode === "wide") {
    const panes = feedCleanupOpen ? ["sidebar", "content"] : resolveLayout(layoutMode, focusedPane, contentMode);
    const shouldShowSidebar = feedCleanupOpen || sidebarOpen;
    return (
      <div
        className={cn(
          "flex h-full overflow-hidden",
          // macOS overlay titlebar 以外は上の空間は詰める。
          overlayTitlebar && "desktop-titlebar-offset desktop-overlay-titlebar",
        )}
      >
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
        <div data-testid="main-stage" className="relative flex min-w-0 flex-1">
          <div data-browser-overlay-root="" className="pointer-events-none absolute inset-0 z-20" />
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

  return (
    <SlidingPaneLayout
      layoutMode={layoutMode}
      focusedPane={focusedPane}
      overlayTitlebar={overlayTitlebar}
      feedCleanupOpen={feedCleanupOpen}
    />
  );
}
