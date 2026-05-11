import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShortcutCategoryOrder } from "@/components/settings/hooks/use-shortcuts-settings-view-props";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import i18n from "@/lib/i18n";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

describe("ShortcutsSettings", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
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

  it("keeps open shortcut settings labels on one locale while language changes", async () => {
    useUiStore.getState().openSettings("shortcuts");

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to Defaults" })).toBeInTheDocument();

    await i18n.changeLanguage("ja");

    expect(screen.getByRole("heading", { name: "Shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to Defaults" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ショートカット" })).not.toBeInTheDocument();
  });

  it("builds shortcut categories in definition order", () => {
    expect(
      buildShortcutCategoryOrder([
        { categoryKey: "shortcuts.category_navigation" },
        { categoryKey: "shortcuts.category_actions" },
        { categoryKey: "shortcuts.category_navigation" },
        { categoryKey: "shortcuts.category_global" },
      ]),
    ).toEqual(["shortcuts.category_navigation", "shortcuts.category_actions", "shortcuts.category_global"]);
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

  it("shows native menu owned shortcut conflicts in the settings list", () => {
    usePreferencesStore.setState({
      prefs: {
        shortcut_reload_webview: "⌘+r",
      },
      loaded: true,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Conflict: native menu")).toBeInTheDocument();
    expect(screen.getByTestId("shortcut-badge-reload_webview")).toHaveTextContent("⌘ r");
  });

  it("ignores locked open settings custom values for display and reset-all", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_open_settings: "x",
      },
      loaded: true,
      setPref,
    });
    useUiStore.setState({
      showConfirm: (_message, onConfirm) => {
        onConfirm();
      },
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(screen.getByTestId("shortcut-badge-open_settings")).toHaveTextContent("⌘ ,");
    expect(screen.getByRole("button", { name: "Reset to Defaults" })).toBeDisabled();

    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "n",
        shortcut_open_settings: "x",
      },
      loaded: true,
      setPref,
    });

    await user.click(screen.getByRole("button", { name: "Reset to Defaults" }));

    expect(setPref).toHaveBeenCalledWith("shortcut_next_article", "j");
    expect(setPref).not.toHaveBeenCalledWith("shortcut_open_settings", "⌘,");
  });

  it("clears the global conflict message when recording a different shortcut starts", async () => {
    const user = userEvent.setup();

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-show_unread"));
    await user.keyboard("m");

    const conflictMessage = /"m" is already assigned to "Toggle read \/ unread"/;

    expect(await screen.findByText(conflictMessage)).toBeInTheDocument();

    await user.click(screen.getByTestId("shortcut-badge-prev_article"));

    expect(screen.queryByText(conflictMessage)).not.toBeInTheDocument();
  });

  it("blocks duplicate custom shortcut recording before saving preferences", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "j",
        shortcut_prev_article: "k",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));
    await user.keyboard("k");

    expect(setPref).not.toHaveBeenCalled();
    expect(screen.getByText(/"k" is already assigned to "Previous article"/)).toBeInTheDocument();
  });

  it("cancels recording with Escape without saving a shortcut preference", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "n",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));

    expect(screen.getByTestId("shortcut-badge-next_article")).toHaveTextContent("Press a key");

    await user.keyboard("{Escape}");

    expect(screen.getByTestId("shortcut-badge-next_article")).toHaveTextContent("n");
    expect(setPref).not.toHaveBeenCalled();
  });

  it("ignores Alt key combinations while recording instead of saving the plain key", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "j",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));

    const recordingButton = screen.getByTestId("shortcut-badge-next_article");
    fireEvent.keyDown(recordingButton, {
      key: "k",
      altKey: true,
    });

    expect(setPref).not.toHaveBeenCalled();
    expect(recordingButton).toHaveTextContent("Press a key");
  });

  it.each([
    ["IME composition", { key: "k", isComposing: true }],
    ["dead key", { key: "Dead" }],
    ["unidentified key", { key: "Unidentified" }],
    ["process key", { key: "Process" }],
  ] as const)("ignores %s while recording", async (_label, keyboardEvent) => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "j",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));

    const recordingButton = screen.getByTestId("shortcut-badge-next_article");
    fireEvent.keyDown(recordingButton, keyboardEvent);

    expect(setPref).not.toHaveBeenCalled();
    expect(recordingButton).toHaveTextContent("Press a key");
  });

  it("blocks native menu owned shortcuts while recording and formats the platform modifier in the warning", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePlatformStore.setState({
      platform: {
        kind: "windows",
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
    usePreferencesStore.setState({
      prefs: {
        shortcut_reload_webview: "r",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-reload_webview"));
    fireEvent.keyDown(screen.getByTestId("shortcut-badge-reload_webview"), {
      key: "r",
      ctrlKey: true,
    });

    expect(setPref).not.toHaveBeenCalled();
    expect(screen.getByText(/"Ctrl r" is already assigned to "native menu"/)).toBeInTheDocument();
  });

  it("refreshes the recorded conflict message when platform or locale changes", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePlatformStore.setState({
      platform: {
        kind: "windows",
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
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "j",
        shortcut_toggle_read: "⌘+q",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));
    fireEvent.keyDown(screen.getByTestId("shortcut-badge-next_article"), {
      key: "q",
      ctrlKey: true,
    });

    expect(screen.getByText(/"Ctrl q" is already assigned to "Toggle read \/ unread"/)).toBeInTheDocument();

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

    await waitFor(() => {
      expect(screen.getByText(/"⌘ q" is already assigned to "Toggle read \/ unread"/)).toBeInTheDocument();
    });

    await i18n.changeLanguage("ja");

    expect(await screen.findByText(/「⌘ q」は「既読\/未読を切り替え」に割り当て済みです/)).toBeInTheDocument();
    expect(setPref).not.toHaveBeenCalled();
  });

  it("shows the shortcuts help collision when recording Shift+Slash", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "j",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("shortcut-badge-next_article"));
    fireEvent.keyDown(screen.getByTestId("shortcut-badge-next_article"), {
      key: "?",
      shiftKey: true,
    });

    expect(setPref).not.toHaveBeenCalled();
    expect(screen.getByText(/"Shift \+ \?" is already assigned to "Open shortcuts help"/)).toBeInTheDocument();
  });

  it("resets one shortcut row without resetting all bindings", async () => {
    const user = userEvent.setup();
    const setPref = vi.fn();
    usePreferencesStore.setState({
      prefs: {
        shortcut_next_article: "n",
        shortcut_prev_article: "p",
      },
      loaded: true,
      setPref,
    });

    render(<ShortcutsSettings />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("button", {
        name: "Reset Next article shortcut to defaults",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Reset Previous article shortcut to defaults",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Reset Open settings shortcut to defaults",
      }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: "Reset Next article shortcut to defaults",
      }),
    );

    expect(setPref).toHaveBeenCalledTimes(1);
    expect(setPref).toHaveBeenCalledWith("shortcut_next_article", "j");
  });
});
