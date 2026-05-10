import { type CSSProperties, type ReactNode, useLayoutEffect, useRef } from "react";
import { MOTION_RESIZE_SURFACE_CLASS_NAME } from "@/constants";
import { ACCOUNT_PANE_WIDTH_PX, ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { computeTranslateX, isPaneVisible, resolveLayout, resolveVisiblePane } from "../hooks/use-layout";
import type { ContentMode } from "../lib/layout/layout-state.types";
import { cn } from "../lib/utils";
import { useUiStore } from "../stores/ui-store";
import { AccountPane } from "./reader/account-pane";
import { ArticleList } from "./reader/article-list";
import { ArticleView } from "./reader/article-view";
import { Sidebar } from "./reader/sidebar";

const HIDDEN_PANE_FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
].join(",");

const PREVIOUS_TAB_INDEX_ATTRIBUTE = "data-app-layout-previous-tabindex";

function disableHiddenPaneFocus(root: HTMLElement) {
  const focusableElements = root.querySelectorAll<HTMLElement>(HIDDEN_PANE_FOCUSABLE_SELECTOR);

  for (const element of focusableElements) {
    if (!element.hasAttribute(PREVIOUS_TAB_INDEX_ATTRIBUTE)) {
      element.setAttribute(PREVIOUS_TAB_INDEX_ATTRIBUTE, element.getAttribute("tabindex") ?? "");
    }
    if (element.getAttribute("tabindex") !== "-1") {
      element.setAttribute("tabindex", "-1");
    }
  }

  if (document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

function restoreHiddenPaneFocus(root: HTMLElement) {
  const managedElements = root.querySelectorAll<HTMLElement>(`[${PREVIOUS_TAB_INDEX_ATTRIBUTE}]`);

  for (const element of managedElements) {
    const previousTabIndex = element.getAttribute(PREVIOUS_TAB_INDEX_ATTRIBUTE);
    element.removeAttribute(PREVIOUS_TAB_INDEX_ATTRIBUTE);

    if (previousTabIndex === "") {
      element.removeAttribute("tabindex");
      continue;
    }

    if (previousTabIndex !== null) {
      element.setAttribute("tabindex", previousTabIndex);
    }
  }
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
        <ArticleView />
      </div>
    );
  }

  const isMobile = layoutMode === "mobile";
  const activePane = resolveVisiblePane(layoutMode, focusedPane, selectedAccountId);
  const translateX = computeTranslateX(layoutMode, activePane);
  const shouldShowAccountPane = !isMobile && accountPaneOpen;

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
          <AccountPane />
        </HiddenPaneBoundary>
        <div className="min-w-0 flex-1 overflow-clip">
          <div
            data-testid="sliding-pane-tray"
            className="flex h-full transition-transform duration-300 ease-in-out motion-reduce:transition-none"
            style={{
              width: isMobile ? "100%" : `calc(100% + ${SIDEBAR_PANE_WIDTH_PX}px)`,
              transform: `translateX(${translateX})`,
            }}
          >
            <HiddenPaneBoundary
              className={cn(isMobile ? "w-full shrink-0" : "shrink-0")}
              style={isMobile ? undefined : { width: `${SIDEBAR_PANE_WIDTH_PX}px` }}
              hidden={!isPaneVisible(layoutMode, activePane, "sidebar")}
            >
              <Sidebar />
            </HiddenPaneBoundary>
            <HiddenPaneBoundary
              className={cn(isMobile ? "w-full shrink-0" : "shrink-0")}
              style={isMobile ? undefined : { width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}
              hidden={!isPaneVisible(layoutMode, activePane, "list")}
            >
              <ArticleList />
            </HiddenPaneBoundary>
            <HiddenPaneBoundary
              className={cn(isMobile ? "w-full shrink-0" : "min-w-0 flex-1")}
              hidden={!isPaneVisible(layoutMode, activePane, "content")}
            >
              <ArticleView />
            </HiddenPaneBoundary>
          </div>
        </div>
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
  const shouldShowSidebar = !subscriptionsWorkspaceOpen && sidebarOpen;
  const shouldShowAccountPane = shouldShowSidebar && accountPaneOpen;

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      {panes.includes("sidebar") && (
        <>
          <div
            data-testid="wide-account-pane-shell"
            className={cn(
              MOTION_RESIZE_SURFACE_CLASS_NAME,
              "shrink-0 overflow-hidden border-r",
              shouldShowAccountPane
                ? "border-border opacity-100 translate-x-0"
                : "border-transparent opacity-0 -translate-x-3",
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
              <AccountPane />
            </HiddenPaneBoundary>
          </div>
          <div
            data-testid="wide-sidebar-shell"
            className={cn(
              MOTION_RESIZE_SURFACE_CLASS_NAME,
              "shrink-0 overflow-hidden border-r",
              shouldShowSidebar
                ? "border-border opacity-100 translate-x-0"
                : "border-transparent opacity-0 -translate-x-3",
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
              <Sidebar />
            </HiddenPaneBoundary>
          </div>
        </>
      )}
      <main data-testid="main-stage" className="flex min-w-0 flex-1">
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
      </main>
      {!panes.includes("list") && !panes.includes("content") && (
        <div className="min-w-0 flex-1">
          <ArticleView />
        </div>
      )}
    </div>
  );
}
