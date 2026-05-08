import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { GeneralSettings } from "@/components/settings/general-settings";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";

describe("GeneralSettings", () => {
  beforeEach(() => {
    setupTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("renders sidebar section switches and updates preferences", async () => {
    const user = userEvent.setup();

    render(<GeneralSettings />, { wrapper: createWrapper() });

    const unread = screen.getByRole("switch", { name: "Show Unread in sidebar" });
    const starred = screen.getByRole("switch", { name: "Show Starred in sidebar" });
    const recent = screen.getByRole("switch", { name: "Show Recently Viewed in sidebar" });
    const tags = screen.getByRole("switch", { name: "Show Tags in sidebar" });

    expect(unread).toBeChecked();
    expect(starred).toBeChecked();
    expect(recent).toBeChecked();
    expect(tags).toBeChecked();

    await user.click(unread);
    await user.click(recent);
    await user.click(tags);

    expect(usePreferencesStore.getState().prefs.show_sidebar_unread).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_recent_articles).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_tags).toBe("false");
    expect(usePreferencesStore.getState().prefs.show_sidebar_starred).toBeUndefined();
  });

  it("renders sync on startup enabled by default and updates the preference", async () => {
    const user = userEvent.setup();

    render(<GeneralSettings />, { wrapper: createWrapper() });

    const syncOnStartup = screen.getByRole("switch", { name: "Sync when the app starts" });
    expect(syncOnStartup).toBeChecked();

    await user.click(syncOnStartup);

    expect(usePreferencesStore.getState().prefs.sync_on_startup).toBe("false");
  });

  it("renders startup folder expansion in the sidebar section and updates the preference", async () => {
    const user = userEvent.setup();

    render(<GeneralSettings />, { wrapper: createWrapper() });

    const expansionMode = screen.getByRole("combobox", { name: "Startup folder expansion" });
    expect(expansionMode).toHaveTextContent("All collapsed");

    await user.click(expansionMode);
    await user.click(await screen.findByRole("option", { name: "Unread folders" }));

    expect(usePreferencesStore.getState().prefs.startup_folder_expansion).toBe("unread_folders");
  });

  it("does not expose the subscription sort control in general settings", () => {
    render(<GeneralSettings />, { wrapper: createWrapper() });

    expect(screen.queryByRole("combobox", { name: "Sort subscriptions" })).not.toBeInTheDocument();
  });

  it("does not expose reading behavior controls in general settings", () => {
    render(<GeneralSettings />, { wrapper: createWrapper() });

    expect(screen.queryByRole("switch", { name: "Ctrl-click opens Web Preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Open original article links in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Open links in background" })).not.toBeInTheDocument();
  });
});
