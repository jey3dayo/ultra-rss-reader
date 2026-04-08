import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebugSettings } from "@/components/settings/debug-settings";
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

    await user.type(screen.getByLabelText("Web preview URL"), "https://example.com/debug");
    await user.click(screen.getByRole("button", { name: "Open now: Open a URL in Web Preview" }));

    expect(usePreferencesStore.getState().prefs.debug_web_preview_url).toBe("https://example.com/debug");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/debug");
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().settingsOpen).toBe(false);
  });

  it("runs debug scenarios from settings", async () => {
    const user = userEvent.setup();

    render(<DebugSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Open now: Open image viewer overlay" }));

    expect(runRuntimeDevScenarioMock).toHaveBeenCalled();
  });
});
