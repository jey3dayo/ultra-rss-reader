import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GeneralSettings } from "@/components/settings/general-settings";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("GeneralSettings", () => {
  beforeEach(() => {
    setupTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    usePlatformStore.setState({
      ...usePlatformStore.getInitialState(),
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
    });
  });

  it("renders sidebar section switches and updates preferences", async () => {
    const user = userEvent.setup();

    render(<GeneralSettings />, { wrapper: createWrapper() });

    const unread = screen.getByRole("switch", { name: "Show Unread" });
    const starred = screen.getByRole("switch", { name: "Show Starred" });
    const tags = screen.getByRole("switch", { name: "Show Tags" });

    expect(unread).toBeChecked();
    expect(starred).toBeChecked();
    expect(tags).toBeChecked();

    await user.click(unread);
    await user.click(tags);

    expect(usePreferencesStore.getState().prefs.show_sidebar_unread).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_tags).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_starred).toBeUndefined();
  });

  it("renders the browser shortcut hint with the current platform modifier", () => {
    render(<GeneralSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("switch", { name: "Ctrl-click opens in-app browser" })).toBeInTheDocument();
  });
});
