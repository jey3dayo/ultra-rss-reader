import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../tests/helpers/tauri-mocks";

const defaultCapabilities = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: false,
  supports_native_browser_navigation: false,
  uses_dev_file_credentials: false,
};

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
    expect(tray).toHaveClass("w-[300%]");

    // sidebar focused: sidebar visible, list and content hidden
    const panes = tray?.children;
    expect(panes).toHaveLength(3);
    expect(panes?.[0]).not.toHaveAttribute("inert");
    expect(panes?.[1]).toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");

    // Switch to list
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list" });
    rerender(<AppLayout />);

    expect(panes?.[0]).toHaveAttribute("inert");
    expect(panes?.[1]).not.toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");

    expect(tray).toHaveStyle({ transform: "translateX(calc(-100% / 3))" });
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
    expect(tray).toHaveClass("w-[calc(100%+280px)]");
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
    expect(container.innerHTML).toContain("w-[380px]");
  });

  it("wide: keeps the sidebar shell mounted and animates it closed when the desktop toggle is off", () => {
    useUiStore.setState({
      layoutMode: "wide",
      focusedPane: "content",
      sidebarOpen: false,
    });

    const { getByTestId, container } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(getByTestId("wide-sidebar-shell")).toHaveClass("w-0");
    expect(getByTestId("wide-sidebar-shell")).toHaveClass("opacity-0");
    expect(container.innerHTML).toContain("w-[380px]");
  });

  it("uses overlay titlebar only when tauri runtime is available on macos platform info", () => {
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: usePlatformStore.getState().platform.kind,
        hasTauriRuntime: true,
      }),
    ).toBe(false);

    const originalPlatform = window.navigator.platform;
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: "unknown",
        hasTauriRuntime: true,
      }),
    ).toBe(true);
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalPlatform,
    });

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
