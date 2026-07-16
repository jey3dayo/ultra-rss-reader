import { listen } from "@tauri-apps/api/event";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { stubNavigatorPlatform } from "@tests/helpers/navigator-platform";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import {
  getFocusDebugHudActiveElementDescription,
  resolveFocusDebugHudPortalTarget,
} from "@/components/app-shell/focus-debug-hud-dom";
import {
  preloadSettingsModalModuleForDev,
  resetSettingsModalPreloadSession,
} from "@/components/app-shell/settings-modal-preload";
import { shouldStartDesktopTitlebarDrag } from "@/components/app-shell/titlebar-drag";
import { APP_EVENTS } from "@/constants/events";
import { TOAST_EXIT_DURATION_MS } from "@/constants/ui-runtime";
import { TAURI_EVENT_LISTENER_FAILURE_EVENT } from "@/lib/runtime/tauri-event-listeners";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const SETTINGS_MODAL_PRELOAD_FAILURE_TOAST = "設定画面の読み込みに失敗しました。アプリの再読み込みを試してください。";

const settingsModalState = vi.hoisted(() => ({ shouldThrow: false }));
const commandPaletteState = vi.hoisted(() => ({ shouldThrow: false }));
const { startDraggingMock } = vi.hoisted(() => ({
  startDraggingMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging: startDraggingMock,
  }),
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
  CommandPalette: () => {
    if (commandPaletteState.shouldThrow) {
      throw new Error("command palette render failed");
    }

    return <div>Command Palette</div>;
  },
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

function preloadSettingsModalModuleForTest(loadModule: () => Promise<unknown>) {
  preloadSettingsModalModuleForDev(loadModule, {
    onInitialFailure: (error) => {
      console.error("Failed to preload settings modal.", error);
      useUiStore.getState().showToast(SETTINGS_MODAL_PRELOAD_FAILURE_TOAST);
    },
    onRetryFailure: (error) => {
      console.error("Failed to retry settings modal preload.", error);
    },
  });
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.mocked(listen).mockClear();
    settingsModalState.shouldThrow = false;
    commandPaletteState.shouldThrow = false;
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePreferencesStore.setState({
      prefs: {},
      loaded: true,
    });
    startDraggingMock.mockClear();
    resetSettingsModalPreloadSession();
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

  it("shares the startup platform info command across React StrictMode double mount", async () => {
    const recorder = createTauriMockCallRecorder();
    setupTauriMocks(recorder.handler);

    render(
      <StrictMode>
        <AppShell />
      </StrictMode>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(usePlatformStore.getState().loaded).toBe(true);
    });

    expect(recorder.calls.filter((call) => call.cmd === "get_platform_info")).toHaveLength(1);
  });

  it("keeps settings modal recovery separate from telemetry when the modal fails to render", async () => {
    settingsModalState.shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useUiStore.setState({ settingsOpen: true });

    try {
      render(<AppShell />, { wrapper: createWrapper() });

      expect(screen.getByText("App Layout")).toBeInTheDocument();
      await waitFor(() => {
        expect(useUiStore.getState().settingsOpen).toBe(false);
      });
      expect(useUiStore.getState().toastMessage).toBeNull();
      expect(consoleError).toHaveBeenCalledWith("Failed to render settings modal.", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps lazy chunk telemetry separate from user recovery side effects", async () => {
    commandPaletteState.shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useUiStore.setState({ commandPaletteOpen: true });

    try {
      render(<AppShell />, { wrapper: createWrapper() });

      expect(screen.getByText("App Layout")).toBeInTheDocument();
      await waitFor(() => {
        expect(useUiStore.getState().toastMessage).toEqual({
          message: "画面の読み込みに失敗しました。アプリの再読み込みを試してください。",
        });
      });
      expect(useUiStore.getState().commandPaletteOpen).toBe(true);
      expect(consoleError).toHaveBeenCalledWith("Failed to render lazy app shell surface.", expect.any(Error));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports repeated lazy boundary failures across separate app shell surfaces", async () => {
    commandPaletteState.shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      useUiStore.setState({ commandPaletteOpen: true });
      const { rerender } = render(<AppShell />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Failed to render lazy app shell surface.", expect.any(Error));
      });
      const firstFailureReportCount = consoleError.mock.calls.length;

      useUiStore.setState({ commandPaletteOpen: false });
      rerender(<AppShell />);
      useUiStore.setState({ commandPaletteOpen: true });
      rerender(<AppShell />);

      await waitFor(() => {
        expect(consoleError.mock.calls.length).toBeGreaterThan(firstFailureReportCount);
      });
      expect(consoleError).toHaveBeenCalledWith("Failed to render lazy app shell surface.", expect.any(Error));
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "画面の読み込みに失敗しました。アプリの再読み込みを試してください。",
      });
    } finally {
      consoleError.mockRestore();
    }
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

      preloadSettingsModalModuleForTest(loadModule);
      preloadSettingsModalModuleForTest(loadModule);
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
      preloadSettingsModalModuleForTest(loadModule);
      expect(loadModule).toHaveBeenCalledTimes(2);
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks settings modal preload retry success as terminal for the current generation", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    try {
      const error = new Error("settings modal preload failed");
      const loadModule = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ SettingsModal: () => null });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      preloadSettingsModalModuleForTest(loadModule);
      await Promise.resolve();
      await Promise.resolve();

      expect(loadModule).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to preload settings modal.", error);

      await vi.advanceTimersByTimeAsync(250);

      expect(loadModule).toHaveBeenCalledTimes(2);
      preloadSettingsModalModuleForTest(loadModule);
      expect(loadModule).toHaveBeenCalledTimes(2);
      expect(consoleError).not.toHaveBeenCalledWith("Failed to retry settings modal preload.", expect.any(Error));
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels stale settings modal preload retries after the preload generation resets", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    try {
      const error = new Error("settings modal preload failed");
      const loadModule = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ SettingsModal: () => null });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      preloadSettingsModalModuleForTest(loadModule);
      await Promise.resolve();
      await Promise.resolve();
      resetSettingsModalPreloadSession();
      await vi.advanceTimersByTimeAsync(250);

      expect(loadModule).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to preload settings modal.", error);
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels stale settings modal preload retries when the app shell unmounts", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    try {
      const error = new Error("settings modal preload failed");
      const loadModule = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ SettingsModal: () => null });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { unmount } = render(<AppShell />, { wrapper: createWrapper() });

      preloadSettingsModalModuleForTest(loadModule);
      await Promise.resolve();
      await Promise.resolve();
      unmount();
      await vi.advanceTimersByTimeAsync(250);

      expect(loadModule).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to preload settings modal.", error);
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels stale settings modal preload retries when the settings session closes", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    try {
      const error = new Error("settings modal preload failed");
      const loadModule = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ SettingsModal: () => null });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      useUiStore.setState({ settingsOpen: true });
      const { rerender } = render(<AppShell />, { wrapper: createWrapper() });

      preloadSettingsModalModuleForTest(loadModule);
      await Promise.resolve();
      await Promise.resolve();
      useUiStore.setState({ settingsOpen: false });
      rerender(<AppShell />);
      await vi.advanceTimersByTimeAsync(250);

      expect(loadModule).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Failed to preload settings modal.", error);
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
    expect(overlayRoot).toHaveClass("z-40");
    expect(appLayout).not.toContainElement(overlayRoot);
    expect(overlayRoot?.parentElement).toBe(container.firstElementChild);
    expect(overlayRoot?.compareDocumentPosition(appLayout)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps the browser overlay root non-interactive so overlay children do not block the reader panes", () => {
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

    expect(overlayRoot).toHaveClass("pointer-events-none");
    expect(overlayRoot).not.toHaveClass("pointer-events-auto");

    useUiStore.setState({
      browserCloseInFlight: true,
    });
    rerender(<AppShell />);

    expect(overlayRoot).toHaveClass("pointer-events-none");
    expect(overlayRoot).not.toHaveClass("pointer-events-auto");

    useUiStore.setState({
      browserCloseInFlight: false,
    });
    rerender(<AppShell />);

    expect(overlayRoot).toHaveClass("pointer-events-none");
    expect(overlayRoot).not.toHaveClass("pointer-events-auto");

    useUiStore.setState({
      contentMode: "reader",
      browserUrl: "https://example.com/stale",
    });
    rerender(<AppShell />);

    expect(overlayRoot).toHaveClass("pointer-events-none");
    expect(overlayRoot).not.toHaveClass("pointer-events-auto");
  });

  it("keeps a shell-owned desktop drag strip behind overlay chrome on macOS tauri", () => {
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
      const dragStrip = screen.getByTestId("desktop-titlebar-drag-strip");
      expect(container.firstElementChild).toHaveClass("desktop-overlay-titlebar-shell");
      expect(container.firstElementChild).not.toHaveClass("desktop-overlay-titlebar");
      expect(overlayRoot).not.toHaveClass("desktop-titlebar-offset");
      expect(overlayRoot).toHaveClass("desktop-overlay-titlebar");
      expect(dragStrip).toHaveAttribute("data-tauri-drag-region");
      expect(dragStrip).toHaveClass("desktop-titlebar-drag-strip", "pointer-events-none", "z-[1]");
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("does not render the desktop titlebar drag strip outside macOS overlay runtime", () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");

    try {
      const { container, rerender } = render(<AppShell />, { wrapper: createWrapper() });

      expect(container.querySelector("[data-testid='desktop-titlebar-drag-strip']")).toBeNull();
      expect(container.firstElementChild).not.toHaveClass("desktop-overlay-titlebar-shell");

      setTauriRuntimePresent();
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

      rerender(<AppShell />);

      expect(container.querySelector("[data-testid='desktop-titlebar-drag-strip']")).toBeNull();
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("starts native window dragging from non-interactive macOS titlebar space", async () => {
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
      const shellRoot = container.firstElementChild;
      if (!(shellRoot instanceof HTMLElement)) {
        throw new Error("Expected shell root");
      }

      const dragStrip = screen.getByTestId("desktop-titlebar-drag-strip");
      fireEvent.pointerDown(dragStrip, { button: 0, clientY: 12 });

      await waitFor(() => {
        expect(startDraggingMock).toHaveBeenCalledOnce();
      });
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("starts native window dragging from the browser overlay top rail", async () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");
    const browserOverlayRail = document.createElement("div");
    browserOverlayRail.dataset.tauriDragRegion = "";
    browserOverlayRail.dataset.testid = "browser-overlay-top-rail";

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

      render(<AppShell />, { wrapper: createWrapper() });
      document.body.append(browserOverlayRail);

      fireEvent.pointerDown(browserOverlayRail, { button: 0, clientY: 64 });

      await waitFor(() => {
        expect(startDraggingMock).toHaveBeenCalledOnce();
      });
    } finally {
      browserOverlayRail.remove();
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("does not start titlebar dragging from arbitrary top-edge app content", () => {
    const content = document.createElement("div");
    document.body.append(content);

    try {
      const event = new MouseEvent("pointerdown", {
        button: 0,
        clientY: 12,
        bubbles: true,
        composed: true,
      }) as PointerEvent;
      content.dispatchEvent(event);

      expect(shouldStartDesktopTitlebarDrag(event)).toBe(false);
    } finally {
      content.remove();
    }
  });

  it("does not start titlebar dragging from interactive titlebar controls", () => {
    const button = document.createElement("button");
    document.body.append(button);

    try {
      const event = new MouseEvent("pointerdown", {
        button: 0,
        clientY: 12,
        bubbles: true,
        composed: true,
      }) as PointerEvent;
      button.dispatchEvent(event);

      expect(shouldStartDesktopTitlebarDrag(event)).toBe(false);
    } finally {
      button.remove();
    }
  });

  it("does not attach OS file-drop listeners before the OPML import boundary is implemented", () => {
    render(<AppShell />, { wrapper: createWrapper() });

    const tauriEventNames = vi.mocked(listen).mock.calls.map(([eventName]) => eventName);
    expect(tauriEventNames).not.toContain("tauri://drag-enter");
    expect(tauriEventNames).not.toContain("tauri://drag-over");
    expect(tauriEventNames).not.toContain("tauri://drag-drop");
    expect(tauriEventNames).not.toContain("tauri://drag-leave");
  });

  it("surfaces native close blocks through the dirty and pending lifecycle registry", async () => {
    render(<AppShell />, { wrapper: createWrapper() });

    const closeBlockedCall = vi
      .mocked(listen)
      .mock.calls.find(([eventName]) => eventName === "main-window-close-blocked");
    const closeBlockedListener = closeBlockedCall?.[1];
    if (!closeBlockedListener) {
      throw new Error("Expected main window close blocked listener");
    }

    act(() => {
      useUiStore.getState().setNativeLifecycleBlocker({
        owner: "settings",
        dirty: true,
        pending: false,
      });
      useUiStore.getState().setNativeLifecycleBlocker({
        owner: "sync",
        dirty: false,
        pending: true,
      });
      closeBlockedListener({
        event: "main-window-close-blocked",
        id: 1,
        payload: undefined,
      });
    });

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "未保存または実行中の処理があるため、終了前に確認してください。",
        persistent: true,
      });
    });
  });

  it("surfaces native close blocks even when only a native update download is in flight", async () => {
    render(<AppShell />, { wrapper: createWrapper() });

    const closeBlockedListener = await waitFor(() => {
      const closeBlockedCall = vi
        .mocked(listen)
        .mock.calls.find(([eventName]) => eventName === "main-window-close-blocked");
      const listener = closeBlockedCall?.[1];
      if (!listener) {
        throw new Error("Expected main window close blocked listener");
      }

      return listener;
    });

    act(() => {
      closeBlockedListener({
        event: "main-window-close-blocked",
        id: 1,
        payload: undefined,
      });
    });

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "未保存または実行中の処理があるため、終了前に確認してください。",
        persistent: true,
      });
    });
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
      const dragStrip = screen.getByTestId("desktop-titlebar-drag-strip");
      expect(overlayRoot).not.toHaveClass("desktop-titlebar-offset");
      expect(overlayRoot).toHaveClass("desktop-overlay-titlebar");
      expect(dragStrip).toHaveAttribute("data-tauri-drag-region");
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
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveClass("hover:bg-surface-1/72");
  });

  it.each([
    ["Clipboard unavailable", "runtime_unavailable"],
    ["Clipboard permission denied", "permission_denied"],
  ] as const)("logs debug HUD copy failures with clipboard category: %s", async (message, category) => {
    setupTauriMocks((cmd) => {
      if (cmd === "copy_to_clipboard") {
        throw { type: "UserVisible", message };
      }

      return undefined;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    enableDebugHud();
    setDebugHudUiState();

    try {
      render(<AppShell />, { wrapper: createWrapper() });

      fireEvent.click(await screen.findByRole("button", { name: "Copy debug HUD" }));

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage?.message).toBe(message);
      });
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to copy focus debug HUD:",
        expect.objectContaining({
          category,
          message,
        }),
      );
      expect(await screen.findByText(new RegExp(`hud-copy error category=${category}`))).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("classifies oversized debug HUD copy payloads as invalid clipboard text before invoking Tauri", async () => {
    const copyCalls: string[] = [];
    setupTauriMocks((cmd) => {
      if (cmd === "copy_to_clipboard") {
        copyCalls.push(cmd);
      }

      return undefined;
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    enableDebugHud();
    setDebugHudUiState();

    try {
      render(<AppShell />, { wrapper: createWrapper() });
      window.dispatchEvent(
        new CustomEvent(APP_EVENTS.debugInputTrace, {
          detail: `12:00:00.000 ${"trace ".repeat(900)}`,
        }),
      );

      fireEvent.click(await screen.findByRole("button", { name: "Copy debug HUD" }));

      await waitFor(() => {
        expect(useUiStore.getState().toastMessage?.message).toBe("Invalid clipboard text");
      });
      expect(copyCalls).toHaveLength(0);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to copy focus debug HUD:",
        expect.objectContaining({
          category: "invalid_text",
          message: "Invalid clipboard text",
        }),
      );
      expect(await screen.findByText(/hud-copy error category=invalid_text/)).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("redacts sensitive debug HUD targets before copying the payload", async () => {
    let copiedText: string | null = null;
    setupTauriMocks((cmd, args) => {
      if (cmd === "copy_to_clipboard" && "text" in args) {
        copiedText = args.text;
        return null;
      }

      return undefined;
    });
    enableDebugHud();
    setDebugHudUiState({
      selectedArticleId: "article-with-secret-target",
    });

    render(<AppShell />, { wrapper: createWrapper() });
    window.dispatchEvent(
      new CustomEvent(APP_EVENTS.debugInputTrace, {
        detail: "12:00:00.000 raw-key a target=input | label=Server URL",
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Copy debug HUD" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBeTruthy();
    });
    expect(copiedText).toContain("input | sensitive=[redacted]");
    expect(copiedText).not.toContain("Server URL");
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

  it("keeps a dismissed toast mounted through its exit transition", async () => {
    vi.useFakeTimers();
    useUiStore.setState({
      toastMessage: {
        message: "Saved",
        persistent: true,
      },
    });

    try {
      render(<AppShell />, { wrapper: createWrapper() });

      act(() => {
        useUiStore.getState().clearToast();
      });

      expect(screen.getByTestId("app-toast")).toHaveAttribute("data-ending-style");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(TOAST_EXIT_DURATION_MS - 1);
      });
      expect(screen.getByTestId("app-toast")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.queryByTestId("app-toast")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it("renders rapid toast replacements through a queued live region", () => {
    setDebugHudUiState();

    render(<AppShell />, { wrapper: createWrapper() });

    act(() => {
      useUiStore.getState().showToast({ message: "Downloading", persistent: true });
      useUiStore.getState().showToast("Saved");
      useUiStore.getState().showToast("Saved");
    });

    const liveRegion = screen.getByTestId("toast-live-region");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "false");
    expect(screen.getByTestId("app-toast")).toHaveTextContent("Saved");
    expect(within(liveRegion).getByText("Downloading")).toBeInTheDocument();
    expect(within(liveRegion).getAllByText("Saved")).toHaveLength(1);
  });

  it("keeps toast recovery actions keyboard reachable", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();

    setDebugHudUiState({
      toastMessage: {
        message: "Recovery required",
        persistent: true,
        actions: [{ label: "Retry", onClick: retry }],
      },
    });

    render(<AppShell />, { wrapper: createWrapper() });

    within(screen.getByTestId("app-toast")).getByRole("button", { name: "Retry" }).focus();
    await user.keyboard("{Enter}");

    expect(retry).toHaveBeenCalledTimes(1);
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
    const cleanupNativeLifecycleCloseBlocked = vi.fn();
    const cleanupBrowserInputTrace = vi.fn();
    vi.mocked(listen).mockImplementation((eventName) =>
      Promise.resolve(
        eventName === "browser-webview-debug-input" ? cleanupBrowserInputTrace : cleanupNativeLifecycleCloseBlocked,
      ),
    );
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
    expect(cleanupBrowserInputTrace).toHaveBeenCalledTimes(1);
    expect(cleanupNativeLifecycleCloseBlocked).toHaveBeenCalledTimes(2);
  });

  it("keeps route and settings modal transitions from accumulating debug HUD Tauri listeners", async () => {
    const activeListeners = new Set<string>();
    const activeDebugHudListeners = new Set<string>();
    vi.mocked(listen).mockImplementation((eventName) => {
      const listenerKey = `${eventName}:${vi.mocked(listen).mock.calls.length}`;
      activeListeners.add(listenerKey);
      if (eventName === "browser-webview-debug-input") {
        activeDebugHudListeners.add(listenerKey);
      }
      return Promise.resolve(() => {
        activeListeners.delete(listenerKey);
        activeDebugHudListeners.delete(listenerKey);
      });
    });

    const { rerender, unmount } = renderAppShellWithDebugHud();

    await waitFor(() => {
      expect(activeDebugHudListeners.size).toBe(1);
      expect(activeListeners.size).toBe(2);
    });

    act(() => {
      useUiStore.setState({ settingsOpen: true });
    });
    rerender(<AppShell />);
    await waitFor(() => {
      expect(screen.getByText("Settings Modal")).toBeInTheDocument();
      expect(activeDebugHudListeners.size).toBe(1);
      expect(activeListeners.size).toBe(2);
    });

    act(() => {
      useUiStore.setState({
        settingsOpen: false,
        contentMode: "browser",
        browserUrl: "https://example.com",
      });
    });
    rerender(<AppShell />);
    await waitFor(() => {
      expect(activeDebugHudListeners.size).toBe(1);
      expect(activeListeners.size).toBe(2);
    });

    unmount();
    expect(activeListeners.size).toBe(0);
  });
});
