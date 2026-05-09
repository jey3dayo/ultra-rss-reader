import { listen } from "@tauri-apps/api/event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { stubNavigatorPlatform } from "@tests/helpers/navigator-platform";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppShell,
  getFocusDebugHudActiveElementDescription,
  preloadSettingsModalModuleForDev,
  resetSettingsModalPreloadForTest,
  resolveFocusDebugHudPortalTarget,
} from "@/components/app-shell";
import { APP_EVENTS } from "@/constants/events";
import { TAURI_EVENT_LISTENER_FAILURE_EVENT } from "@/lib/runtime/tauri-event-listeners";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const settingsModalState = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/hooks/use-app-icon-theme", () => ({ useAppIconTheme: vi.fn() }));
vi.mock("@/hooks/use-badge", () => ({ useBadge: vi.fn() }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: vi.fn() }));
vi.mock("@/hooks/use-keyboard", () => ({ useKeyboard: vi.fn() }));
vi.mock("@/hooks/use-menu-events", () => ({ useMenuEvents: vi.fn() }));
vi.mock("@/hooks/use-updater", () => ({ useUpdater: vi.fn() }));
vi.mock("@/hooks/use-window-always-on-top", () => ({
  useWindowAlwaysOnTop: vi.fn(),
}));

vi.mock("@/components/app-layout", () => ({
  AppLayout: () => <div>App Layout</div>,
}));

vi.mock("@/components/app-confirm-dialog", () => ({
  AppConfirmDialog: () => null,
}));

vi.mock("@/components/settings/settings-modal", () => ({
  SettingsModal: () => {
    if (settingsModalState.shouldThrow) {
      throw new Error("settings modal render failed");
    }

    return <div>Settings Modal</div>;
  },
}));

vi.mock("@/components/reader/command-palette", () => ({
  CommandPalette: () => <div>Command Palette</div>,
}));

function enableDebugHud() {
  usePreferencesStore.setState((state) => ({
    ...state,
    prefs: { ...state.prefs, debug_browser_hud: "true" },
  }));
}

function renderAppShellWithDebugHud() {
  enableDebugHud();
  return render(<AppShell />, { wrapper: createWrapper() });
}

function setDebugHudUiState(overrides: Partial<ReturnType<typeof useUiStore.getInitialState>> = {}) {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    focusedPane: "list",
    contentMode: "reader",
    selectedArticleId: "art-1",
    ...overrides,
  });
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(listen).mockClear();
    settingsModalState.shouldThrow = false;
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePreferencesStore.setState({
      prefs: {},
      loaded: true,
    });
    resetSettingsModalPreloadForTest();
    setupTauriMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the main layout mounted when the store opens subscriptions workspace", () => {
    useUiStore.setState({ subscriptionsWorkspace: { kind: "index" } });

    const { container } = render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByText("App Layout")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("bg-background", "text-foreground");
  });

  it("does not mount the settings modal until it is opened", () => {
    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.queryByText("Settings Modal")).not.toBeInTheDocument();
  });

  it("keeps the app shell mounted when the settings modal fails to render", async () => {
    settingsModalState.shouldThrow = true;
    useUiStore.setState({ settingsOpen: true });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByText("App Layout")).toBeInTheDocument();
    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false);
    });
  });

  it("surfaces Tauri event listener attach failures as a toast", async () => {
    render(<AppShell />, { wrapper: createWrapper() });

    window.dispatchEvent(new CustomEvent(TAURI_EVENT_LISTENER_FAILURE_EVENT));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "デスクトップ連携の一部を開始できませんでした。",
      });
    });
  });

  it("surfaces settings modal preload rejection and retries only once", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    try {
      const error = new Error("settings modal preload failed");
      const retryError = new Error("settings modal preload retry failed");
      const loadModule = vi.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(retryError);
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      preloadSettingsModalModuleForDev(loadModule);
      preloadSettingsModalModuleForDev(loadModule);
      await Promise.resolve();
      await Promise.resolve();

      expect(loadModule).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to preload settings modal.", error);
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "設定画面の読み込みに失敗しました。アプリの再読み込みを試してください。",
      });

      await vi.advanceTimersByTimeAsync(250);

      expect(loadModule).toHaveBeenCalledTimes(2);
      expect(consoleError).toHaveBeenCalledWith("Failed to retry settings modal preload.", retryError);
      preloadSettingsModalModuleForDev(loadModule);
      expect(loadModule).toHaveBeenCalledTimes(2);
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("mounts the browser overlay root as a shell child that spans the entire app shell", () => {
    const { container } = render(<AppShell />, { wrapper: createWrapper() });

    const overlayRoot = container.querySelector<HTMLElement>("[data-browser-overlay-root]");
    const appLayout = screen.getByText("App Layout");

    expect(overlayRoot).toBeInTheDocument();
    expect(overlayRoot).toHaveClass("absolute");
    expect(overlayRoot).toHaveClass("inset-0");
    expect(appLayout).not.toContainElement(overlayRoot);
    expect(overlayRoot?.parentElement).toBe(container.firstElementChild);
    expect(overlayRoot?.compareDocumentPosition(appLayout)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the browser overlay root non-interactive until browser mode is active", () => {
    const { container, rerender } = render(<AppShell />, {
      wrapper: createWrapper(),
    });

    const overlayRoot = container.querySelector<HTMLElement>("[data-browser-overlay-root]");
    expect(overlayRoot).toHaveClass("pointer-events-none");
    expect(overlayRoot).not.toHaveClass("pointer-events-auto");

    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
    });
    rerender(<AppShell />);

    expect(overlayRoot).toHaveClass("pointer-events-auto");
    expect(overlayRoot).not.toHaveClass("pointer-events-none");
  });

  it("keeps the desktop overlay titlebar helper classes on the shell overlay root without adding a shell-wide drag strip", () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");

    try {
      setTauriRuntimePresent();
      usePlatformStore.setState({
        platform: {
          kind: "macos",
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

      const { container } = render(<AppShell />, { wrapper: createWrapper() });

      const overlayRoot = container.querySelector<HTMLElement>("[data-browser-overlay-root]");
      expect(container.firstElementChild).not.toHaveClass("desktop-overlay-titlebar");
      expect(overlayRoot).not.toHaveClass("desktop-titlebar-offset");
      expect(overlayRoot).toHaveClass("desktop-overlay-titlebar");
      expect(container.querySelector("[data-testid='desktop-titlebar-drag-strip']")).toBeNull();
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("uses overlay titlebar helper classes on first render when tauri is available and mac platform info is still unknown", () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");
    const restorePlatform = stubNavigatorPlatform({ platform: "MacIntel" });

    try {
      setTauriRuntimePresent();
      usePlatformStore.setState({
        platform: {
          kind: "unknown",
          capabilities: {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: false,
            supports_native_browser_navigation: false,
            uses_dev_file_credentials: false,
          },
        },
        loaded: false,
        loadError: false,
        inFlightLoad: null,
      });

      const { container } = render(<AppShell />, { wrapper: createWrapper() });

      const overlayRoot = container.querySelector<HTMLElement>("[data-browser-overlay-root]");
      expect(overlayRoot).not.toHaveClass("desktop-titlebar-offset");
      expect(overlayRoot).toHaveClass("desktop-overlay-titlebar");
    } finally {
      restorePlatform();
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("copies the debug HUD contents when clicked", async () => {
    enableDebugHud();
    setDebugHudUiState();

    render(<AppShell />, { wrapper: createWrapper() });

    const copyButton = await screen.findByRole("button", {
      name: "Copy debug HUD",
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBeTruthy();
    });

    const toastMessage = useUiStore.getState().toastMessage?.message;
    expect(toastMessage).toBeTruthy();
    if (!toastMessage) {
      throw new Error("Expected copy toast message to be set");
    }
    expect(screen.getAllByText(toastMessage).length).toBeGreaterThan(0);
    expect(screen.getByTestId("app-toast")).toHaveClass("motion-popup-surface");
    expect(screen.getByTestId("app-toast")).toHaveAttribute("data-open");
    expect(screen.getByTestId("app-toast")).toHaveAttribute("data-side", "top");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("hover:bg-surface-1/72");
  });

  it("copies the debug HUD contents when activated from the keyboard", async () => {
    const user = userEvent.setup();

    enableDebugHud();
    setDebugHudUiState();

    render(<AppShell />, { wrapper: createWrapper() });

    const copyButton = await screen.findByRole("button", {
      name: "Copy debug HUD",
    });
    copyButton.focus();

    expect(copyButton).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBeTruthy();
    });
  });

  it("moves the bottom-right debug HUD away while an undo toast is visible", async () => {
    enableDebugHud();
    setDebugHudUiState({
      toastMessage: {
        message: "Undo available",
        actions: [{ label: "Undo", onClick: vi.fn() }],
      },
    });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByTestId("app-toast")).toBeInTheDocument();

    const copyButton = await screen.findByRole("button", {
      name: "Copy debug HUD",
    });
    const container = copyButton.closest("section")?.parentElement;

    expect(container).toHaveClass("top-4", "right-4");
    expect(container).not.toHaveClass("bottom-4");
  });

  it("treats the debug HUD portal target as a document.body-only boundary", () => {
    expect(resolveFocusDebugHudPortalTarget()).toBe(document.body);
    expect(resolveFocusDebugHudPortalTarget(null)).toBeNull();
    expect(
      resolveFocusDebugHudPortalTarget({
        activeElement: null,
        body: { nodeType: Node.ELEMENT_NODE },
        defaultView: window,
      }),
    ).toBeNull();
  });

  it("describes malformed or unavailable debug HUD focus targets as none", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Debug action");
    document.body.append(button);

    try {
      button.focus();

      expect(getFocusDebugHudActiveElementDescription()).toContain("label=Debug action");
      expect(getFocusDebugHudActiveElementDescription(null)).toBe("none");
      expect(
        getFocusDebugHudActiveElementDescription({
          activeElement: { nodeType: Node.ELEMENT_NODE },
          body: document.body,
          defaultView: window,
        }),
      ).toBe("none");
      expect(
        getFocusDebugHudActiveElementDescription({
          get activeElement() {
            throw new Error("activeElement unavailable");
          },
          body: document.body,
          defaultView: window,
        }),
      ).toBe("none");
    } finally {
      button.remove();
    }
  });

  it("keeps regular toast width content-sized", () => {
    setDebugHudUiState({
      toastMessage: {
        message: "Copied",
      },
    });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByTestId("app-toast").className).not.toContain("w-[min(320px,calc(100vw-2rem))]");
  });

  it("places toast in the browser rail while the native web preview is open", () => {
    setDebugHudUiState({
      browserUrl: "https://example.com/article",
      toastMessage: {
        message: "Link copied",
      },
    });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByTestId("app-toast")).toHaveClass("top-1", "right-20");
    expect(screen.getByTestId("app-toast")).not.toHaveClass("left-1/2");
    expect(screen.getByTestId("app-toast")).not.toHaveClass("bottom-4");
  });

  it("applies a stable width to update toasts", () => {
    setDebugHudUiState({
      toastMessage: {
        message: "ダウンロード中… 90%",
        persistent: true,
        progress: 90,
        variant: "update",
      },
    });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByTestId("app-toast").className).toContain("w-[min(320px,calc(100vw-2rem))]");
  });

  it("temporarily hides the debug HUD while the settings modal is open", async () => {
    const { rerender } = renderAppShellWithDebugHud();

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();

    useUiStore.setState({ settingsOpen: true });
    rerender(<AppShell />);

    expect(screen.getByText("Settings Modal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy debug HUD" })).not.toBeInTheDocument();

    useUiStore.setState({ settingsOpen: false });
    rerender(<AppShell />);

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();
  });

  it("temporarily hides the debug HUD while the confirm dialog is open", async () => {
    const { rerender } = renderAppShellWithDebugHud();

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();

    useUiStore.getState().showConfirm("Delete feed?", vi.fn(), { actionLabel: "Delete" });
    rerender(<AppShell />);

    expect(useUiStore.getState().confirmDialog.open).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy debug HUD" })).not.toBeInTheDocument();

    useUiStore.getState().closeConfirm();
    rerender(<AppShell />);

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();
  });

  it("temporarily hides the debug HUD while shortcut and command overlays are open", async () => {
    const { rerender } = renderAppShellWithDebugHud();

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();

    useUiStore.setState({ shortcutsHelpOpen: true });
    rerender(<AppShell />);

    expect(useUiStore.getState().shortcutsHelpOpen).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy debug HUD" })).not.toBeInTheDocument();

    useUiStore.setState({ shortcutsHelpOpen: false, commandPaletteOpen: true });
    rerender(<AppShell />);

    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy debug HUD" })).not.toBeInTheDocument();

    useUiStore.setState({ commandPaletteOpen: false });
    rerender(<AppShell />);

    expect(await screen.findByRole("button", { name: "Copy debug HUD" })).toBeInTheDocument();
  });

  it("turns off the debug HUD preference from the HUD close action", async () => {
    const user = userEvent.setup();

    renderAppShellWithDebugHud();

    await user.click(await screen.findByRole("button", { name: "Hide debug HUD" }));

    expect(usePreferencesStore.getState().prefs.debug_browser_hud).toBe("false");
    expect(screen.queryByRole("button", { name: "Hide debug HUD" })).not.toBeInTheDocument();
  });

  it("shows browser geometry rows inside the debug HUD when preview diagnostics are published", async () => {
    renderAppShellWithDebugHud();

    fireEvent(
      window,
      new CustomEvent(APP_EVENTS.browserDebugGeometry, {
        detail: {
          layoutDiagnostics: {
            viewport: { width: 1274, height: 801 },
            overlay: { x: 0, y: 0, width: 1274, height: 801 },
            hostLogical: { x: 0, y: 56, width: 1274, height: 745 },
            stage: { x: 0, y: 56, width: 1274, height: 745 },
            lane: { left: 0, top: 56, right: 0, bottom: 0 },
          },
          nativeDiagnostics: {
            action: "create",
            requestedLogical: { x: 0, y: 56, width: 1274, height: 745 },
            appliedLogical: { x: 0, y: 56, width: 1274, height: 745 },
            scaleFactor: 1.1,
            nativeWebviewBounds: { x: 0, y: 56, width: 1547, height: 905 },
          },
        },
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Expand debug HUD" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show" }));

    expect(await screen.findByText("Geometry")).toBeInTheDocument();
    expect(screen.getByText("viewport")).toBeInTheDocument();
    expect(screen.getByText("1274 x 801")).toBeInTheDocument();
    expect(screen.getByText("host")).toBeInTheDocument();
    expect(screen.getAllByText("0,56 1274 x 745").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("native")).toBeInTheDocument();
    expect(screen.getByText("0,56 1547 x 905")).toBeInTheDocument();
    expect(screen.getByText("delta")).toBeInTheDocument();
    expect(screen.getByText("x0 y0 w273 h160")).toBeInTheDocument();
  });

  it("keeps native browser input traces scoped to the debug HUD lifecycle", async () => {
    const hiddenHudRender = render(<AppShell />, { wrapper: createWrapper() });

    expect(vi.mocked(listen)).not.toHaveBeenCalledWith("browser-webview-debug-input", expect.any(Function));

    hiddenHudRender.unmount();
    const { unmount } = renderAppShellWithDebugHud();

    await waitFor(() => {
      expect(vi.mocked(listen)).toHaveBeenCalledWith("browser-webview-debug-input", expect.any(Function));
    });

    const browserTraceCall = vi
      .mocked(listen)
      .mock.calls.find(([eventName]) => eventName === "browser-webview-debug-input");
    const browserTraceListener = browserTraceCall?.[1];
    if (!browserTraceListener) {
      throw new Error("Expected browser debug input trace listener");
    }

    browserTraceListener({
      event: "browser-webview-debug-input",
      id: 1,
      payload: "native-click target=webview",
    });

    fireEvent.click(await screen.findByRole("button", { name: "Expand debug HUD" }));
    expect(await screen.findByText("native-click target=webview")).toBeInTheDocument();

    unmount();
    expect(screen.queryByText("native-click target=webview")).not.toBeInTheDocument();
  });
});
