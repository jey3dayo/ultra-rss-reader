import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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
    setupTauriMocks();
  });

  it("keeps the main layout mounted when the store opens feed cleanup", () => {
    useUiStore.setState({ feedCleanupOpen: true });

    render(<AppShell />, { wrapper: createWrapper() });

    expect(screen.getByText("App Layout")).toBeInTheDocument();
  });

  it("mounts the browser overlay root as a shell sibling before AppLayout", () => {
    const { container } = render(<AppShell />, { wrapper: createWrapper() });

    const overlayRoot = container.querySelector<HTMLElement>("[data-browser-overlay-root]");
    const appLayout = screen.getByText("App Layout");

    expect(overlayRoot).toBeInTheDocument();
    expect(overlayRoot).toHaveClass("absolute");
    expect(overlayRoot).toHaveClass("inset-0");
    expect(appLayout).not.toContainElement(overlayRoot);
    expect(overlayRoot?.parentElement).toBe(appLayout.parentElement);
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
});
