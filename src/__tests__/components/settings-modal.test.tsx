import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModal } from "@/components/settings/settings-modal";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("SettingsModal", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings();
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return sampleAccounts;
      }
      return null;
    });
  });

  it("exposes an accessible name for the close button", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close preferences" })).toBeInTheDocument();
  });

  it("shows default enabled states in actions settings when preferences are unset", () => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    render(<ActionsSettings />, { wrapper: createWrapper() });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    expect(switches[0]).toBeChecked();
    expect(switches[1]).toBeChecked();
    expect(switches[2]).toBeChecked();
    expect(switches[3]).toBeChecked();
  });

  it("shows default display mode options in reading settings", () => {
    usePreferencesStore.setState({ prefs: { reader_view: "fullscreen" }, loaded: true });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Default display mode" })).toHaveTextContent("Fullscreen");
  });
});
