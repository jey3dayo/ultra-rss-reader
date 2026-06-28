import { act, render, screen, waitFor } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { stubNavigatorPlatform } from "@tests/helpers/navigator-platform";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { ARTICLE_LIST_PANE_WIDTH_PX, SIDEBAR_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { flushTestMutationObservers } from "../../tests/setup";

const defaultCapabilities = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: false,
  supports_native_browser_navigation: false,
  uses_dev_file_credentials: false,
};

function getSlidingPanes() {
  return Array.from(screen.getByTestId("sliding-pane-tray").children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

describe("App", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    setupTauriMocks();
  });

  it("mobile: renders sliding layout with all panes and correct inert/aria-hidden", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    const tray = screen.getByTestId("sliding-pane-tray");
    expect(tray.parentElement).toHaveClass("overflow-clip");
    expect(tray).toHaveStyle({ width: "100%" });

    // sidebar focused: sidebar visible, list and content hidden
    let panes = tray?.children;
    expect(panes).toHaveLength(3);
    expect(panes?.[0]).not.toHaveAttribute("inert");
    expect(panes?.[1]).toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");

    // Switch to list
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list", selectedAccountId: "acc-1" });
    rerender(<AppLayout />);
    panes = screen.getByTestId("sliding-pane-tray").children;

    expect(panes?.[0]).toHaveAttribute("inert");
    expect(panes?.[1]).not.toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");

    expect(tray).toHaveStyle({ transform: "translateX(-100%)" });

    // Switch to content
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "content", selectedAccountId: "acc-1" });
    rerender(<AppLayout />);
    panes = screen.getByTestId("sliding-pane-tray").children;

    expect(panes?.[0]).toHaveAttribute("inert");
    expect(panes?.[1]).toHaveAttribute("inert");
    expect(panes?.[2]).not.toHaveAttribute("inert");

    expect(tray).toHaveStyle({ transform: "translateX(-200%)" });
  });

  it("mobile: removes hidden pane descendants from fallback keyboard focus when inert is unsupported", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list", selectedAccountId: "acc-1" });

    render(<AppLayout />, { wrapper: createWrapper() });

    const [sidebarPane, listPane, contentPane] = getSlidingPanes();
    const hiddenFocusable = sidebarPane?.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    const visibleFocusable = listPane?.querySelector<HTMLElement>("button, [href], input, [tabindex]");

    expect(sidebarPane).toHaveAttribute("aria-hidden", "true");
    expect(contentPane).toHaveAttribute("aria-hidden", "true");
    expect(hiddenFocusable).not.toBeNull();
    expect(hiddenFocusable).toHaveAttribute("tabindex", "-1");
    expect(visibleFocusable).not.toBeNull();
    expect(visibleFocusable).not.toHaveAttribute("tabindex", "-1");

    hiddenFocusable?.focus();
    expect(document.activeElement).not.toBe(hiddenFocusable);
  });

  it("mobile: restores descendant tab order when a hidden pane becomes visible", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    const initialListFocusable = getSlidingPanes()[1]?.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    expect(initialListFocusable).not.toBeNull();
    expect(initialListFocusable).toHaveAttribute("tabindex", "-1");

    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list", selectedAccountId: "acc-1" });
    rerender(<AppLayout />);

    const restoredListFocusable = getSlidingPanes()[1]?.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    expect(restoredListFocusable).not.toBeNull();
    expect(restoredListFocusable).not.toHaveAttribute("tabindex", "-1");
  });

  it("mobile: restores hidden pane descendants when subscriptions workspace unmounts the pane tray", async () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    const hiddenListPane = getSlidingPanes()[1];
    const initialListFocusable = hiddenListPane?.querySelector<HTMLElement>("button, [href], input, [tabindex]");
    const lazyButton = document.createElement("button");
    lazyButton.type = "button";
    lazyButton.textContent = "Lazy child";
    await act(async () => {
      hiddenListPane?.append(lazyButton);
      flushTestMutationObservers();
    });

    expect(initialListFocusable).not.toBeNull();
    await waitFor(() => {
      expect(initialListFocusable).toHaveAttribute("tabindex", "-1");
    });
    await waitFor(() => {
      expect(lazyButton).toHaveAttribute("tabindex", "-1");
    });

    useUiStore.setState({ subscriptionsWorkspace: { kind: "index" }, focusedPane: "content" });
    rerender(<AppLayout />);

    expect(screen.queryByTestId("sliding-pane-tray")).not.toBeInTheDocument();
    expect(initialListFocusable).not.toHaveAttribute("tabindex", "-1");
    expect(initialListFocusable).not.toHaveAttribute("data-hidden-pane-previous-tabindex");
    expect(lazyButton).not.toHaveAttribute("tabindex");
    expect(lazyButton).not.toHaveAttribute("data-hidden-pane-previous-tabindex");
  });

  it("mobile: no fixed-width sidebar/list classes", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { container } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(container.innerHTML).not.toContain("w-[280px]");
    expect(container.innerHTML).not.toContain("w-[380px]");
  });

  it("compact: renders sliding layout with correct tray width", () => {
    useUiStore.setState({ layoutMode: "compact", focusedPane: "sidebar" });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: defaultCapabilities,
      },
      loaded: true,
    });

    render(<AppLayout />, { wrapper: createWrapper() });

    const tray = screen.getByTestId("sliding-pane-tray");
    expect(tray).toHaveStyle({ width: `calc(100% + ${SIDEBAR_PANE_WIDTH_PX}px)` });
  });

  it("wide: renders conditional panes without sliding tray", () => {
    useUiStore.setState({ layoutMode: "wide", focusedPane: "sidebar" });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: defaultCapabilities,
      },
      loaded: true,
    });

    const { container } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(container.firstElementChild).not.toHaveClass("desktop-titlebar-offset");
    expect(container.firstElementChild).not.toHaveClass("desktop-overlay-titlebar");

    // Wide mode has no sliding tray
    expect(container.innerHTML).not.toContain("w-[300%]");
    expect(container.innerHTML).not.toContain("w-[calc(100%+280px)]");
    expect(container.innerHTML).toContain('data-testid="wide-sidebar-shell"');
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
    expect(screen.getByRole("main")).toBe(screen.getByTestId("main-stage"));
  });

  it("wide: keeps the sidebar shell mounted and animates it closed when the desktop toggle is off", () => {
    useUiStore.setState({
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: false,
    });

    const { getByTestId } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(getByTestId("wide-sidebar-shell")).toHaveStyle({ width: "0px" });
    expect(getByTestId("wide-sidebar-shell")).toHaveClass("opacity-0");
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
  });

  it("wide: restores the folder sidebar after closing Web Preview", () => {
    useUiStore.setState({
      layoutMode: "wide",
      focusedPane: "content",
      selectedArticleId: "article-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article-1",
      sidebarOpen: false,
    });

    const { rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(screen.getByTestId("wide-sidebar-shell")).toHaveStyle({ width: "0px" });
    expect(screen.getByTestId("wide-sidebar-content")).toHaveAttribute("inert");
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });

    act(() => {
      useUiStore.getState().closeBrowser();
    });
    rerender(<AppLayout />);

    expect(screen.getByTestId("wide-sidebar-shell")).toHaveStyle({ width: `${SIDEBAR_PANE_WIDTH_PX}px` });
    expect(screen.getByTestId("wide-sidebar-content")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("main-stage").firstElementChild).toHaveStyle({
      width: `${ARTICLE_LIST_PANE_WIDTH_PX}px`,
    });
  });

  it("uses overlay titlebar only when tauri runtime is available on macos platform info", () => {
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: usePlatformStore.getState().platform.kind,
        hasTauriRuntime: true,
      }),
    ).toBe(false);

    const restorePlatform = stubNavigatorPlatform({ platform: "MacIntel" });
    try {
      expect(
        shouldUseDesktopOverlayTitlebar({
          platformKind: "unknown",
          hasTauriRuntime: true,
        }),
      ).toBe(true);
    } finally {
      restorePlatform();
    }

    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: defaultCapabilities,
      },
      loaded: true,
    });
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: usePlatformStore.getState().platform.kind,
        hasTauriRuntime: true,
      }),
    ).toBe(true);

    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          ...defaultCapabilities,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
        },
      },
      loaded: true,
    });
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: usePlatformStore.getState().platform.kind,
        hasTauriRuntime: true,
      }),
    ).toBe(false);
  });
});
