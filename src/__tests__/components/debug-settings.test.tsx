import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebugSettings } from "@/components/settings/debug-settings";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const { runRuntimeDevScenarioMock } = vi.hoisted(() => ({
  runRuntimeDevScenarioMock: vi.fn(),
}));

vi.mock("@/lib/dev-scenario-runtime", () => ({
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
    await user.click(screen.getByRole("button", { name: "Open now: Web preview URL" }));

    expect(usePreferencesStore.getState().prefs.debug_web_preview_url).toBe("https://example.com/debug");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/debug");
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("opens the geometry check page instead of the old image viewer overlay flow", async () => {
    const user = userEvent.setup();
    const geometryCheckUrl = new URL("/dev-web-preview-geometry.html", window.location.origin).toString();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.queryByRole("button", { name: "Open now: Open image viewer overlay" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open now: Open web preview geometry check" }));

    expect(runRuntimeDevScenarioMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().browserUrl).toBe(geometryCheckUrl);
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("keeps long debug action labels on one line", () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Open web preview geometry check")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Open feed cleanup broken references")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Open reading display mode settings")).toHaveClass("whitespace-nowrap");
  });

  it("shows the current credentials backend and relaunch hint", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("OS keyring")).toBeInTheDocument();
    expect(screen.getByText(/mise run app:dev/i)).toBeInTheDocument();
    expect(screen.getByText(/mise run app:dev:native-keyring/i)).toBeInTheDocument();
  });
});
