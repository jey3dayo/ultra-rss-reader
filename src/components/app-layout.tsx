import { ACCOUNT_PANE_WIDTH_PX, ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { computeTranslateX, isPaneVisible, resolveLayout } from "../hooks/use-layout";
import { cn } from "../lib/utils";
import { type ContentMode, useUiStore } from "../stores/ui-store";
import { AccountPane } from "./reader/account-pane";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
  subscriptionsWorkspaceOpen,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  subscriptionsWorkspaceOpen: boolean;
}) {
  if (subscriptionsWorkspaceOpen) {
    return (
      <div className="h-full overflow-hidden bg-background text-foreground">
        <ArticleView />
      </div>
    );
  }

  const isMobile = layoutMode === "mobile";
  const translateX = computeTranslateX(layoutMode, focusedPane);

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <div
        data-testid="sliding-pane-tray"
        className="flex h-full transition-transform duration-300 ease-in-out motion-reduce:duration-0"
        style={{
          width: isMobile ? "300%" : `calc(100% + ${SIDEBAR_PANE_WIDTH_PX}px)`,
          transform: `translateX(${translateX})`,
        }}
      >
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "shrink-0")}
          style={isMobile ? undefined : { width: `${SIDEBAR_PANE_WIDTH_PX}px` }}
          aria-hidden={!isPaneVisible(layoutMode, focusedPane, "sidebar")}
          {...(!isPaneVisible(layoutMode, focusedPane, "sidebar") ? { inert: true } : {})}
        >
          <Sidebar />
        </div>
        <div
          className={cn(isMobile ? "w-1/3 shrink-0" : "shrink-0")}
          style={isMobile ? undefined : { width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}
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
  const subscriptionsWorkspace = useUiStore((state) => state.subscriptionsWorkspace);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const accountPaneOpen = useUiStore((state) => state.accountPaneOpen);
  const subscriptionsWorkspaceOpen = subscriptionsWorkspace !== null;

  return (
    // Keep layout flush to the top edge. macOS titlebar spacing lives in AppShell,
    // otherwise the visible header and the draggable titlebar band diverge again.
    <div className="relative h-full overflow-hidden bg-background text-foreground">
      {layoutMode === "wide" ? (
        <WideLayout
          focusedPane={focusedPane}
          contentMode={contentMode}
          subscriptionsWorkspaceOpen={subscriptionsWorkspaceOpen}
          sidebarOpen={sidebarOpen}
          accountPaneOpen={accountPaneOpen}
        />
      ) : (
        <SlidingPaneLayout
          layoutMode={layoutMode}
          focusedPane={focusedPane}
          subscriptionsWorkspaceOpen={subscriptionsWorkspaceOpen}
        />
      )}
    </div>
  );
}

function WideLayout({
  focusedPane,
  contentMode,
  subscriptionsWorkspaceOpen,
  sidebarOpen,
  accountPaneOpen,
}: {
  focusedPane: "sidebar" | "list" | "content";
  contentMode: ContentMode;
  subscriptionsWorkspaceOpen: boolean;
  sidebarOpen: boolean;
  accountPaneOpen: boolean;
}) {
  const panes = subscriptionsWorkspaceOpen ? ["content"] : resolveLayout("wide", focusedPane, contentMode);
  const shouldShowSidebar = !subscriptionsWorkspaceOpen && sidebarOpen;
  const shouldShowAccountPane = shouldShowSidebar && accountPaneOpen;

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      {panes.includes("sidebar") && (
        <>
          <div
            data-testid="wide-account-pane-shell"
            className={cn(
              "shrink-0 overflow-hidden border-r transition-[width,opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              shouldShowAccountPane
                ? "border-border opacity-100 translate-x-0"
                : "border-transparent opacity-0 -translate-x-3",
            )}
            style={{ width: shouldShowAccountPane ? `${ACCOUNT_PANE_WIDTH_PX}px` : "0px" }}
          >
            <div
              data-testid="wide-account-pane-content"
              className={cn("h-full", !shouldShowAccountPane && "pointer-events-none")}
              style={{ width: `${ACCOUNT_PANE_WIDTH_PX}px` }}
              aria-hidden={!shouldShowAccountPane}
              {...(!shouldShowAccountPane ? { inert: true } : {})}
            >
              <AccountPane />
            </div>
          </div>
          <div
            data-testid="wide-sidebar-shell"
            className={cn(
              "shrink-0 overflow-hidden border-r transition-[width,opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              shouldShowSidebar
                ? "border-border opacity-100 translate-x-0"
                : "border-transparent opacity-0 -translate-x-3",
            )}
            style={{ width: shouldShowSidebar ? `${SIDEBAR_PANE_WIDTH_PX}px` : "0px" }}
          >
            <div
              data-testid="wide-sidebar-content"
              className={cn("h-full", !shouldShowSidebar && "pointer-events-none")}
              style={{ width: `${SIDEBAR_PANE_WIDTH_PX}px` }}
              aria-hidden={!shouldShowSidebar}
              {...(!shouldShowSidebar ? { inert: true } : {})}
            >
              <Sidebar />
            </div>
          </div>
        </>
      )}
      <div data-testid="main-stage" className="flex min-w-0 flex-1">
        {panes.includes("list") && (
          <div className="shrink-0" style={{ width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}>
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
