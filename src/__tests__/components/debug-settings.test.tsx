import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebugSettings } from "@/components/settings/debug-settings";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { runRuntimeDevScenarioMock } = vi.hoisted(() => ({
  runRuntimeDevScenarioMock: vi.fn(),
}));

vi.mock("@/dev/scenario-runtime", () => ({
  runRuntimeDevScenario: runRuntimeDevScenarioMock,
}));

describe("DebugSettings", () => {
  beforeEach(() => {
    setupTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
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
    useUiStore.setState(useUiStore.getInitialState());
    runRuntimeDevScenarioMock.mockReset();
  });

  it("toggles the web preview hud preference", async () => {
    const user = userEvent.setup();

    render(<DebugSettings />, { wrapper: createWrapper() });

    const toggle = screen.getByRole("switch", { name: "Show layout HUD" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(usePreferencesStore.getState().prefs.debug_browser_hud).toBe("true");
  });

  it("opens the saved web preview url from settings", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.queryByText("Open a URL in Web Preview")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Web preview URL"), "https://example.com/debug");
    await user.click(screen.getByRole("button", { name: "Open: Web preview URL" }));

    expect(usePreferencesStore.getState().prefs.debug_web_preview_url).toBe("https://example.com/debug");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/debug");
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("shows a localized toast for an invalid non-empty web preview url", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    await user.type(screen.getByLabelText("Web preview URL"), "not a url");
    await user.click(screen.getByRole("button", { name: "Open: Web preview URL" }));

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Enter a valid web preview URL.",
    });
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it("keeps debug recovery actions keyboard reachable and surfaces toast feedback", async () => {
    const user = userEvent.setup();
    const geometryCheckUrl = new URL("/dev-web-preview-geometry.html", window.location.origin).toString();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    screen.getByRole("button", { name: "Open toast check" }).focus();
    await user.keyboard("{Enter}");

    expect(useUiStore.getState().browserUrl).toBe(geometryCheckUrl);
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Link copied",
    });
  });

  it("opens the geometry check page instead of the old image viewer overlay flow", async () => {
    const user = userEvent.setup();
    const geometryCheckUrl = new URL("/dev-web-preview-geometry.html", window.location.origin).toString();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.queryByRole("button", { name: "Open: Image viewer overlay" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open geometry check" }));

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().browserUrl).toBe(geometryCheckUrl);
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("opens the web preview toast check state", async () => {
    const user = userEvent.setup();
    const geometryCheckUrl = new URL("/dev-web-preview-geometry.html", window.location.origin).toString();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Open toast check" }));

    expect(useUiStore.getState().browserUrl).toBe(geometryCheckUrl);
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Link copied",
    });
  });

  it("keeps long debug action labels on one line", () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Web preview geometry check")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Web preview toast check")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Reading display mode settings")).toHaveClass("whitespace-nowrap");
  });

  it("shows the current credentials backend and relaunch hint", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("OS keyring")).toBeInTheDocument();
    expect(screen.getByText(/relaunching with `mise run app:dev`/i)).toBeInTheDocument();
    expect(screen.getByText(/mise run app:dev:native-keyring/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Reset oversized dev credential store",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows dev credential reset only for dev file credentials and reports success", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      if (cmd === "get_platform_info") {
        return {
          kind: "macos",
          capabilities: {
            supports_reading_list: true,
            supports_background_browser_open: true,
            supports_runtime_window_icon_replacement: true,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: true,
          },
        };
      }
      if (cmd === "reset_oversized_dev_credentials_store") {
        return true;
      }
      return undefined;
    });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("Dev file credentials")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Reset oversized dev credential store",
      }),
    );

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Dev credentials were moved aside. Restart the app and reconnect accounts.",
    });
  });

  it("shows explicit debug copy when platform info loading fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "get_platform_info") {
        throw new Error("platform unavailable");
      }
      return undefined;
    });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(
      await screen.findByText("Platform info unavailable. Credentials backend was not detected."),
    ).toBeInTheDocument();
    expect(screen.queryByText("OS keyring")).not.toBeInTheDocument();
  });

  it("shows Dev data seed safety guidance without an execution button", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("Dev data seed")).toBeInTheDocument();
    expect(screen.getByText("Source label")).toBeInTheDocument();
    expect(screen.getByText(/product metrics as Dev mock data/i)).toBeInTheDocument();
    expect(screen.getByText("mise run app:dev:seed-from-prod")).toBeInTheDocument();
    expect(screen.getByText(/timestamped backup/i)).toBeInTheDocument();
    expect(screen.getByText(/Production credentials are not copied/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seed/i })).not.toBeInTheDocument();
  });

  it("surfaces support log privacy checklist next to debug support workflow", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("Support log privacy")).toBeInTheDocument();
    expect(screen.getByText(/Open logs from Data settings/i)).toBeInTheDocument();
    expect(screen.getByText(/redacted app\.log excerpt/i)).toBeInTheDocument();
    expect(screen.getByText(/account names, feed URLs, article URLs, and local user paths/i)).toBeInTheDocument();
    expect(screen.getByText(/stale support\/debug logs and support dumps/i)).toBeInTheDocument();
    expect(screen.getByText(/private, unencrypted backup database files/i)).toBeInTheDocument();
  });

  it("hides Dev data seed guidance outside dev builds", async () => {
    vi.stubEnv("DEV", false);
    try {
      render(<DebugSettings />, { wrapper: createWrapper() });

      expect(await screen.findByText("OS keyring")).toBeInTheDocument();
      expect(screen.queryByText("Dev data seed")).not.toBeInTheDocument();
      expect(screen.queryByText("mise run app:dev:seed-from-prod")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
