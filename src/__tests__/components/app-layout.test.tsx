import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/components/reader/sidebar", () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock("@/components/reader/article-list", () => ({
  ArticleList: () => <div>Article List</div>,
}));

vi.mock("@/components/reader/article-view", () => ({
  ArticleView: () => <div>Article View</div>,
}));

describe("AppLayout", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
  });

  it("shows only the workspace content when feed cleanup is open in wide layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      subscriptionsWorkspace: { kind: "cleanup", cleanupContext: null },
      focusedPane: "content",
    });

    render(<AppLayout />);

    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByText("Article List")).not.toBeInTheDocument();
    expect(screen.queryByText("Sidebar")).not.toBeInTheDocument();
  });

  it("keeps subscriptions workspaces content-only in wide layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      subscriptionsWorkspace: { kind: "index", cleanupContext: null },
      focusedPane: "content",
    });

    render(<AppLayout />);

    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByTestId("wide-sidebar-shell")).not.toBeInTheDocument();
    expect(screen.queryByText("Sidebar")).not.toBeInTheDocument();
  });

  it("keeps a closable sidebar shell mounted in wide layout for open and close motion", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: false,
    });

    render(<AppLayout />);

    const shell = screen.getByTestId("wide-sidebar-shell");

    expect(shell).toHaveClass("transition-[width,opacity,transform,border-color]");
    expect(shell).toHaveClass("opacity-0");
    expect(shell).toHaveStyle({ width: "0px" });
    const sidebarContent = screen.getByTestId("wide-sidebar-content");
    expect(sidebarContent).toHaveAttribute("aria-hidden", "true");
    expect(sidebarContent).toHaveAttribute("inert");
  });

  it("uses the shared pane width constants for desktop widths", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: true,
    });

    render(<AppLayout />);

    expect(screen.getByTestId("wide-sidebar-shell")).toHaveStyle({ width: `${SIDEBAR_PANE_WIDTH_PX}px` });
    expect(screen.getByTestId("wide-sidebar-content")).toHaveStyle({ width: `${SIDEBAR_PANE_WIDTH_PX}px` });
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
  });

  it("does not render the browser overlay root inside AppLayout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
    });

    const { container } = render(<AppLayout />);

    expect(container.querySelector("[data-browser-overlay-root]")).toBeNull();
  });
});
