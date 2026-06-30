import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    usePreferencesStore.setState({ prefs: { developer_mode: "true" }, loaded: true });
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("toggles the web preview hud preference", async () => {
    const user = userEvent.setup();

    render(<DebugSettings />, { wrapper: createWrapper() });

    const toggle = screen.getByRole("switch", { name: "Show layout HUD" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(usePreferencesStore.getState().prefs.debug_browser_hud).toBe("true");
  });

  it("lets Agentation visibility be managed from debug overlays", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", true);

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Developer Overlays")).toBeInTheDocument();
    const visibilitySelect = screen.getByRole("combobox", { name: "Agentation" });
    expect(visibilitySelect).toHaveTextContent("Always show");

    await user.click(visibilitySelect);
    await user.click(await screen.findByRole("option", { name: "Do not show" }));

    expect(usePreferencesStore.getState().prefs.debug_agentation_visibility).toBe("off");
  });

  it("opens the saved web preview url from settings", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(screen.queryByText("Open a URL in Web Preview")).not.toBeInTheDocument();
    const urlInput = screen.getByLabelText("Web preview URL");
    await user.clear(urlInput);
    await user.type(urlInput, "https://example.com/debug");
    await user.click(screen.getByRole("button", { name: "Open: Web preview URL" }));

    expect(usePreferencesStore.getState().prefs.debug_web_preview_url).toBe("https://example.com/debug");
    expect(useUiStore.getState().settingsOpen).toBe(false);
    await waitFor(() => {
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/debug");
      expect(useUiStore.getState().contentMode).toBe("browser");
    });
  });

  it("shows a localized toast for an invalid non-empty web preview url", async () => {
    const user = userEvent.setup();

    useUiStore.setState({ settingsOpen: true });

    render(<DebugSettings />, { wrapper: createWrapper() });

    const urlInput = screen.getByLabelText("Web preview URL");
    await user.clear(urlInput);
    await user.type(urlInput, "not a url");
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

  it("stacks long debug action rows so labels can wrap in narrow cards", () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    const geometryLabel = screen.getByText("Web preview geometry check");
    const toastLabel = screen.getByText("Web preview toast check");
    const displayModeLabel = screen.getByText("Reading display mode settings");

    expect(geometryLabel).not.toHaveClass("whitespace-nowrap");
    expect(toastLabel).not.toHaveClass("whitespace-nowrap");
    expect(displayModeLabel).not.toHaveClass("whitespace-nowrap");
    expect(geometryLabel.closest(".motion-contextual-surface")).toHaveClass("lg:grid-cols-1");
    expect(toastLabel.closest(".motion-contextual-surface")).toHaveClass("lg:grid-cols-1");
    expect(displayModeLabel.closest(".motion-contextual-surface")).toHaveClass("lg:grid-cols-1");
    expect(screen.getByRole("button", { name: "Open geometry check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open toast check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open reading display mode check" })).toBeInTheDocument();
  });

  it("shows the current credentials backend and restart hint", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("OS keyring")).toBeInTheDocument();
    expect(screen.getByText("Restart the Dev app after changing credential backend.")).toBeInTheDocument();
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

  it("shows the Dev data seed command without an execution button", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("Dev data seed")).toBeInTheDocument();
    expect(screen.getByText("mise run app:dev:seed-from-prod")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /seed/i })).not.toBeInTheDocument();
  });

  it("omits support log privacy guidance from the developer debug surface", async () => {
    render(<DebugSettings />, { wrapper: createWrapper() });

    expect(await screen.findByText("Development")).toBeInTheDocument();
    expect(screen.queryByText("Support log privacy")).not.toBeInTheDocument();
    expect(screen.queryByText(/redacted app\.log excerpt/i)).not.toBeInTheDocument();
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
