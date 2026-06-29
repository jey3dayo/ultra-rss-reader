import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { ACCOUNT_PANE_WIDTH_PX, ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { WORKSPACE_DETAIL_PANE_WIDTH } from "@/design-system";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/components/reader/sidebar", () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

vi.mock("@/components/reader/account-pane", () => ({
  AccountPane: () => <div>Account Pane</div>,
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

  it("shows only the workspace content when subscriptions workspace is open in wide layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      subscriptionsWorkspace: { kind: "index" },
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
      subscriptionsWorkspace: { kind: "index" },
      focusedPane: "content",
    });

    render(<AppLayout />);

    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByTestId("wide-sidebar-shell")).not.toBeInTheDocument();
    expect(screen.queryByText("Sidebar")).not.toBeInTheDocument();
  });

  it("keeps subscriptions workspaces outside the mobile pane recovery tray", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      subscriptionsWorkspace: { kind: "index" },
      focusedPane: "sidebar",
      selectedAccountId: null,
    });

    render(<AppLayout />);

    expect(screen.getByRole("main")).toBe(screen.getByTestId("main-stage"));
    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.queryByTestId("sliding-pane-tray")).not.toBeInTheDocument();
    expect(screen.queryByText("Article List")).not.toBeInTheDocument();
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

    expect(shell).toHaveClass("motion-resize-surface");
    expect(shell).toHaveClass("opacity-0");
    expect(shell).toHaveStyle({ width: "0px" });
    const sidebarContent = screen.getByTestId("wide-sidebar-content");
    expect(sidebarContent).toHaveAttribute("aria-hidden", "true");
    expect(sidebarContent).toHaveAttribute("inert");
  });

  it("disables sliding pane transition for reduced motion", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "compact",
    });

    render(<AppLayout />);

    expect(screen.getByTestId("sliding-pane-tray")).toHaveClass("motion-reduce:transition-none");
  });

  it("uses the shared pane width constants for desktop widths", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: true,
    });

    render(<AppLayout />);

    expect(screen.getByTestId("wide-sidebar-shell")).toHaveStyle({
      width: `${SIDEBAR_PANE_WIDTH_PX}px`,
    });
    expect(screen.getByTestId("wide-sidebar-content")).toHaveStyle({
      width: `${SIDEBAR_PANE_WIDTH_PX}px`,
    });
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
    expect(screen.getByTestId("main-stage").firstElementChild).not.toHaveStyle({
      width: `${WORKSPACE_DETAIL_PANE_WIDTH}px`,
    });
  });

  it("uses an articles and contents two-pane layout in wide browser mode", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: true,
      accountPaneOpen: true,
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });

    render(<AppLayout />);

    expect(screen.getByTestId("wide-account-pane-shell")).toHaveClass(
      "motion-resize-surface",
      "opacity-0",
      "border-r-0",
    );
    expect(screen.getByTestId("wide-account-pane-shell")).toHaveStyle({ width: "0px" });
    expect(screen.getByTestId("wide-account-pane-content")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("wide-account-pane-content")).toHaveAttribute("inert");
    expect(screen.getByTestId("wide-sidebar-shell")).toHaveClass("motion-resize-surface", "opacity-0", "border-r-0");
    expect(screen.getByTestId("wide-sidebar-shell")).toHaveStyle({ width: "0px" });
    expect(screen.getByTestId("wide-sidebar-content")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("wide-sidebar-content")).toHaveAttribute("inert");
    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Account Pane")).toBeInTheDocument();
    expect(screen.getByText("Article List")).toBeInTheDocument();
    expect(screen.getByText("Article View")).toBeInTheDocument();
    expect(screen.getByTestId("main-stage").children).toHaveLength(2);
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
  });

  it("gives wide article panes bounded height so their inner scroll areas can scroll", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    render(<AppLayout />);

    const stage = screen.getByTestId("main-stage");
    const listPane = stage.children[0];
    const contentPane = stage.children[1];

    expect(stage).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(listPane).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(contentPane).toHaveClass("h-full", "min-h-0", "overflow-hidden");
  });

  it("keeps app shell responsive constraints outside the workspace split helper", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: true,
    });

    const { container } = render(<AppLayout />);

    expect(container.firstElementChild).toHaveClass("relative", "h-full", "overflow-hidden");
    expect(screen.getByTestId("main-stage")).toHaveClass("flex", "min-w-0", "flex-1");
    expect(screen.getByTestId("main-stage")).not.toHaveClass("lg:grid-cols-[minmax(0,1fr)_480px]");
  });

  it("keeps the transient account pane mounted for wide layout open and close motion", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "sidebar",
      sidebarOpen: true,
      accountPaneOpen: false,
    });

    render(<AppLayout />);

    const shell = screen.getByTestId("wide-account-pane-shell");
    expect(shell).toHaveClass("motion-resize-surface");
    expect(shell).toHaveClass("opacity-0");
    expect(shell).toHaveStyle({ width: "0px" });
    expect(screen.getByTestId("wide-account-pane-content")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("wide-account-pane-content")).toHaveAttribute("inert");
    expect(screen.getByText("Account Pane")).toBeInTheDocument();
  });

  it("opens the transient account pane at the left edge in wide layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "wide",
      focusedPane: "sidebar",
      sidebarOpen: true,
      accountPaneOpen: true,
    });

    render(<AppLayout />);

    expect(screen.getByTestId("wide-account-pane-shell")).toHaveClass("opacity-100", "translate-x-0");
    expect(screen.getByTestId("wide-account-pane-shell")).not.toHaveStyle({
      width: "0px",
    });
    expect(screen.getByTestId("wide-account-pane-content")).not.toHaveAttribute("aria-hidden", "true");
  });

  it("opens the transient account pane at the left edge in compact layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "compact",
      focusedPane: "sidebar",
      accountPaneOpen: true,
    });

    render(<AppLayout />);

    const shell = screen.getByTestId("compact-account-pane-shell");
    expect(shell).toHaveClass("motion-resize-surface");
    expect(shell).toHaveClass("opacity-100", "translate-x-0");
    expect(shell).toHaveStyle({ width: `${ACCOUNT_PANE_WIDTH_PX}px` });
    expect(shell).not.toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Account Pane")).toBeInTheDocument();
  });

  it("keeps the transient account pane hidden in mobile layout", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "sidebar",
      accountPaneOpen: true,
    });

    render(<AppLayout />);

    const shell = screen.getByTestId("compact-account-pane-shell");
    expect(shell).toHaveClass("opacity-0");
    expect(shell).toHaveStyle({ width: "0px" });
    expect(shell).toHaveAttribute("aria-hidden", "true");
    expect(shell).toHaveAttribute("inert");
  });

  it("falls back to the sidebar pane on mobile when no account is selected", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "list",
      selectedAccountId: null,
    });

    render(<AppLayout />);

    expect(screen.getByRole("main")).toBe(screen.getByTestId("main-stage"));
    const tray = screen.getByTestId("sliding-pane-tray");
    const [sidebarPane, listPane, contentPane] = Array.from(tray.children);

    expect(tray).toHaveStyle({ transform: "translateX(0%)" });
    expect(sidebarPane).not.toHaveAttribute("inert");
    expect(listPane).toHaveAttribute("inert");
    expect(contentPane).toHaveAttribute("inert");
  });

  it("keeps the content pane visible on mobile when content is focused", () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "content",
      selectedAccountId: "acc-1",
    });

    render(<AppLayout />);

    expect(screen.getByRole("main")).toBe(screen.getByTestId("main-stage"));
    const tray = screen.getByTestId("sliding-pane-tray");
    const [sidebarPane, listPane, contentPane] = Array.from(tray.children);

    expect(tray).toHaveStyle({ transform: "translateX(-200%)" });
    expect(sidebarPane).toHaveAttribute("inert");
    expect(listPane).toHaveAttribute("inert");
    expect(contentPane).not.toHaveAttribute("inert");
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
