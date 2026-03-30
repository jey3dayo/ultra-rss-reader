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
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  overlayTitlebar: boolean;
}) {
  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div className={cn("h-full overflow-hidden", overlayTitlebar && "desktop-overlay-titlebar")}>
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
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  if (layoutMode === "wide") {
    const panes = resolveLayout(layoutMode, focusedPane, contentMode);
    return (
      <div className={cn("flex h-full overflow-hidden", overlayTitlebar && "desktop-overlay-titlebar")}>
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

  return <SlidingPaneLayout layoutMode={layoutMode} focusedPane={focusedPane} overlayTitlebar={overlayTitlebar} />;
}
