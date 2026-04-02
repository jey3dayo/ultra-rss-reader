import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("ShortcutsSettings", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
  });

  it("renders direct filter shortcuts as separate actions from read and star toggles", () => {
    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Show unread articles")).toBeInTheDocument();
    expect(screen.getByText("Show all articles")).toBeInTheDocument();
    expect(screen.getByText("Show starred articles")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-badge-show_unread")).toHaveTextContent("⌘ 1");
    expect(screen.getByTestId("shortcut-badge-show_all")).toHaveTextContent("⌘ 2");
    expect(screen.getByTestId("shortcut-badge-show_starred")).toHaveTextContent("⌘ 3");
    expect(screen.getByTestId("shortcut-badge-toggle_read")).toHaveTextContent("m");
    expect(screen.getByTestId("shortcut-badge-toggle_star")).toHaveTextContent("s");
  });

  it("shows conflicts when a direct filter shortcut collides with an article toggle shortcut", () => {
    usePreferencesStore.setState({
      prefs: {
        shortcut_show_unread: "⌘+1",
        shortcut_toggle_read: "⌘+1",
      },
      loaded: true,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(screen.getAllByText(/Conflict:/)).toHaveLength(2);
    expect(screen.getByText(/Conflict: Toggle read \/ unread/)).toBeInTheDocument();
    expect(screen.getByText(/Conflict: Show unread articles/)).toBeInTheDocument();
  });
});
