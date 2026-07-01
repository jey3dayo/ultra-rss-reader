import { type CSSProperties, lazy, type ReactNode, Suspense, useLayoutEffect, useRef } from "react";
import { MOTION_RESIZE_SURFACE_CLASS_NAME } from "@/constants";
import { ACCOUNT_PANE_WIDTH_PX, ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { disableHiddenPaneFocus, restoreHiddenPaneFocus } from "@/lib/dom/hidden-pane-focus";
import { computeTranslateX, isPaneVisible, resolveLayout, resolveVisiblePane } from "../hooks/use-layout";
import type { ContentMode } from "../lib/layout/layout-state.types";
import { cn } from "../lib/utils";
import { useUiStore } from "../stores/ui-store";

const AccountPane = lazy(async () => {
  const mod = await import("./reader/account-pane");
  return { default: mod.AccountPane };
});
const ArticleList = lazy(async () => {
  const mod = await import("./reader/article-list");
  return { default: mod.ArticleList };
});
const ArticleView = lazy(async () => {
  const mod = await import("./reader/article-view");
  return { default: mod.ArticleView };
});
const Sidebar = lazy(async () => {
  const mod = await import("./reader/sidebar");
  return { default: mod.Sidebar };
});

function LazyPaneContent({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div aria-hidden="true" className="h-full min-h-0 min-w-0" />}>{children}</Suspense>;
}

function DeferredLazyPaneContent({ active, children }: { active: boolean; children: ReactNode }) {
  const hasBeenActiveRef = useRef(active);
  const shouldRender = active || hasBeenActiveRef.current;

  useLayoutEffect(() => {
    if (active) {
      hasBeenActiveRef.current = true;
    }
  }, [active]);

  if (!shouldRender) {
    return null;
  }

  return <LazyPaneContent>{children}</LazyPaneContent>;
}

function HiddenPaneBoundary({
  hidden,
  children,
  className,
  style,
  testId,
}: {
  hidden: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  const paneRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) {
      return;
    }

    if (hidden) {
      disableHiddenPaneFocus(pane);

      const observer = new MutationObserver(() => disableHiddenPaneFocus(pane));
      observer.observe(pane, {
        attributes: true,
        attributeFilter: ["tabindex"],
        childList: true,
        subtree: true,
      });

      return () => {
        observer.disconnect();
        restoreHiddenPaneFocus(pane);
      };
    }

    restoreHiddenPaneFocus(pane);
  }, [hidden]);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane || !hidden) {
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      event.target.blur();
    };

    pane.addEventListener("focusin", handleFocusIn);
    return () => pane.removeEventListener("focusin", handleFocusIn);
  }, [hidden]);

  return (
    <div
      ref={paneRef}
      data-testid={testId}
      className={className}
      style={style}
      aria-hidden={hidden}
      {...(hidden ? { inert: true } : {})}
    >
      {children}
    </div>
  );
}

function SlidingPaneLayout({
  layoutMode,
  focusedPane,
  selectedAccountId,
  accountPaneOpen,
  subscriptionsWorkspaceOpen,
}: {
  layoutMode: "compact" | "mobile";
  focusedPane: "sidebar" | "list" | "content";
  selectedAccountId: string | null;
  accountPaneOpen: boolean;
  subscriptionsWorkspaceOpen: boolean;
}) {
  if (subscriptionsWorkspaceOpen) {
    return (
      <div className="h-full overflow-hidden bg-background text-foreground">
        <main data-testid="main-stage" className="h-full">
          <LazyPaneContent>
            <ArticleView />
          </LazyPaneContent>
        </main>
      </div>
    );
  }

  const isMobile = layoutMode === "mobile";
  const activePane = resolveVisiblePane(layoutMode, focusedPane, selectedAccountId);
  const translateX = computeTranslateX(layoutMode, activePane);
  const shouldShowAccountPane = !isMobile && accountPaneOpen;
  const showSidebarPane = isPaneVisible(layoutMode, activePane, "sidebar");
  const showListPane = isPaneVisible(layoutMode, activePane, "list");
  const showContentPane = isPaneVisible(layoutMode, activePane, "content");

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full overflow-hidden">
        <HiddenPaneBoundary
          testId="compact-account-pane-shell"
          className={cn(
            MOTION_RESIZE_SURFACE_CLASS_NAME,
            "h-full shrink-0 overflow-hidden border-r border-border bg-background",
            shouldShowAccountPane ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
          )}
          style={{
            width: shouldShowAccountPane ? `${ACCOUNT_PANE_WIDTH_PX}px` : "0px",
          }}
          hidden={!shouldShowAccountPane}
        >
          <DeferredLazyPaneContent active={shouldShowAccountPane}>
            <AccountPane />
          </DeferredLazyPaneContent>
        </HiddenPaneBoundary>
        <main data-testid="main-stage" className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            data-testid="sliding-pane-tray"
            className="flex h-full min-h-0 transition-transform duration-300 ease-in-out motion-reduce:transition-none"
            style={{
              width: isMobile ? "100%" : `calc(100% + ${SIDEBAR_PANE_WIDTH_PX}px)`,
              transform: `translateX(${translateX})`,
            }}
          >
            <HiddenPaneBoundary
              testId="sliding-sidebar-pane-shell"
              className={cn("h-full min-h-0 overflow-hidden", isMobile ? "w-full shrink-0" : "shrink-0")}
              style={isMobile ? undefined : { width: `${SIDEBAR_PANE_WIDTH_PX}px` }}
              hidden={!showSidebarPane}
            >
              <DeferredLazyPaneContent active={showSidebarPane}>
                <Sidebar />
              </DeferredLazyPaneContent>
            </HiddenPaneBoundary>
            <HiddenPaneBoundary
              testId="sliding-list-pane-shell"
              className={cn("h-full min-h-0 overflow-hidden", isMobile ? "w-full shrink-0" : "shrink-0")}
              style={isMobile ? undefined : { width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}
              hidden={!showListPane}
            >
              <DeferredLazyPaneContent active={showListPane}>
                <ArticleList />
              </DeferredLazyPaneContent>
            </HiddenPaneBoundary>
            <HiddenPaneBoundary
              testId="sliding-content-pane-shell"
              className={cn("h-full min-h-0 overflow-hidden", isMobile ? "w-full shrink-0" : "min-w-0 flex-1")}
              hidden={!showContentPane}
            >
              <DeferredLazyPaneContent active={showContentPane}>
                <ArticleView />
              </DeferredLazyPaneContent>
            </HiddenPaneBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  const layoutMode = useUiStore((state) => state.layoutMode);
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
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
          selectedAccountId={selectedAccountId}
          accountPaneOpen={accountPaneOpen}
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
  const sidebarPaneAvailable = !subscriptionsWorkspaceOpen && panes.includes("sidebar");
  const shouldShowSidebar = sidebarPaneAvailable && sidebarOpen;
  const shouldShowAccountPane = shouldShowSidebar && accountPaneOpen;

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      {!subscriptionsWorkspaceOpen && (
        <>
          <div
            data-testid="wide-account-pane-shell"
            className={cn(
              MOTION_RESIZE_SURFACE_CLASS_NAME,
              "shrink-0 overflow-hidden",
              shouldShowAccountPane
                ? "border-border opacity-100 translate-x-0"
                : "border-r-0 border-transparent opacity-0 -translate-x-3",
              shouldShowAccountPane && "border-r",
            )}
            style={{
              width: shouldShowAccountPane ? `${ACCOUNT_PANE_WIDTH_PX}px` : "0px",
            }}
          >
            <HiddenPaneBoundary
              testId="wide-account-pane-content"
              className={cn("h-full", !shouldShowAccountPane && "pointer-events-none")}
              style={{ width: `${ACCOUNT_PANE_WIDTH_PX}px` }}
              hidden={!shouldShowAccountPane}
            >
              <DeferredLazyPaneContent active={shouldShowAccountPane}>
                <AccountPane />
              </DeferredLazyPaneContent>
            </HiddenPaneBoundary>
          </div>
          <div
            data-testid="wide-sidebar-shell"
            className={cn(
              MOTION_RESIZE_SURFACE_CLASS_NAME,
              "shrink-0 overflow-hidden",
              shouldShowSidebar
                ? "border-border opacity-100 translate-x-0"
                : "border-r-0 border-transparent opacity-0 -translate-x-3",
              shouldShowSidebar && "border-r",
            )}
            style={{
              width: shouldShowSidebar ? `${SIDEBAR_PANE_WIDTH_PX}px` : "0px",
            }}
          >
            <HiddenPaneBoundary
              testId="wide-sidebar-content"
              className={cn("h-full", !shouldShowSidebar && "pointer-events-none")}
              style={{ width: `${SIDEBAR_PANE_WIDTH_PX}px` }}
              hidden={!shouldShowSidebar}
            >
              <DeferredLazyPaneContent active={shouldShowSidebar}>
                <Sidebar />
              </DeferredLazyPaneContent>
            </HiddenPaneBoundary>
          </div>
        </>
      )}
      <main data-testid="main-stage" className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {panes.includes("list") && (
          <div className="h-full min-h-0 shrink-0 overflow-hidden" style={{ width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}>
            <LazyPaneContent>
              <ArticleList />
            </LazyPaneContent>
          </div>
        )}
        {panes.includes("content") && (
          <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <LazyPaneContent>
              <ArticleView />
            </LazyPaneContent>
          </div>
        )}
      </main>
      {!panes.includes("list") && !panes.includes("content") && (
        <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          <LazyPaneContent>
            <ArticleView />
          </LazyPaneContent>
        </div>
      )}
    </div>
  );
}
