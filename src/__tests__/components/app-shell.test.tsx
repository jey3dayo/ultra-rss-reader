import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { APP_EVENTS } from "@/constants/events";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/hooks/use-app-icon-theme", () => ({ useAppIconTheme: vi.fn() }));
vi.mock("@/hooks/use-badge", () => ({ useBadge: vi.fn() }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: vi.fn() }));
vi.mock("@/hooks/use-keyboard", () => ({ useKeyboard: vi.fn() }));
vi.mock("@/hooks/use-menu-events", () => ({ useMenuEvents: vi.fn() }));
vi.mock("@/hooks/use-updater", () => ({ useUpdater: vi.fn() }));

vi.mock("@/components/app-layout", () => ({
  AppLayout: () => <div>App Layout</div>,
}));

vi.mock("@/components/app-confirm-dialog", () => ({
  AppConfirmDialog: () => null,
}));

vi.mock("@/components/settings/settings-modal", () => ({
  SettingsModal: () => null,
}));

vi.mock("@/components/reader/command-palette", () => ({
  CommandPalette: () => <div>Command Palette</div>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePreferencesStore.setState({
      prefs: {},
      loaded: true,
    });
    setupTauriMocks();
  });

  it("keeps the main layout mounted when the store opens feed cleanup", () => {
    useUiStore.setState({ feedCleanupOpen: true });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByText("App Layout")).toBeInTheDocument();
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

  it("keeps the desktop overlay titlebar helper classes on the shell overlay root", () => {
    const originalTauriInternalsDescriptor = Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__");

    try {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        writable: true,
        value: {},
      });
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

      expect(overlayRoot).toHaveClass("desktop-titlebar-offset");
      expect(overlayRoot).toHaveClass("desktop-overlay-titlebar");
    } finally {
      if (originalTauriInternalsDescriptor) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", originalTauriInternalsDescriptor);
      } else {
        delete window.__TAURI_INTERNALS__;
      }
    }
  });

  it("copies the debug HUD contents when clicked", async () => {
    usePreferencesStore.setState((state) => ({
      ...state,
      prefs: { ...state.prefs, debug_browser_hud: "true" },
    }));
    useUiStore.setState({
      focusedPane: "list",
      contentMode: "reader",
      selectedArticleId: "art-1",
    });

    render(<AppShell />, { wrapper: createWrapper() });

    const copyButton = screen.getByRole("button", { name: "Copy debug HUD" });
    fireEvent.pointerDown(copyButton);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBeTruthy();
    });

    const toastMessage = useUiStore.getState().toastMessage?.message;
    expect(toastMessage).toBeTruthy();
    if (!toastMessage) {
      throw new Error("Expected copy toast message to be set");
    }
    expect(screen.getByText(toastMessage)).toBeInTheDocument();
  });

  it("shows browser geometry rows inside the debug HUD when preview diagnostics are published", async () => {
    usePreferencesStore.setState((state) => ({
      ...state,
      prefs: { ...state.prefs, debug_browser_hud: "true" },
    }));

    render(<AppShell />, { wrapper: createWrapper() });

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

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(await screen.findByText("Geometry")).toBeInTheDocument();
    expect(screen.getByText("viewport")).toBeInTheDocument();
    expect(screen.getByText("1274 x 801")).toBeInTheDocument();
    expect(screen.getByText("native")).toBeInTheDocument();
    expect(screen.getByText("1547 x 905")).toBeInTheDocument();
  });
});
