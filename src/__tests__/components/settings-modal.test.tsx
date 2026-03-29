import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModal } from "@/components/settings/settings-modal";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@/components/settings/settings-modal-view", () => ({
  SettingsModalView: ({
    open,
    title,
    closeLabel,
    navigation,
    accountsNavigation,
    content,
    onClose,
  }: SettingsModalViewProps) =>
    open ? (
      <div>
        <h1>{title}</h1>
        <button type="button" onClick={onClose}>
          {closeLabel}
        </button>
        <div>{navigation}</div>
        <div>{accountsNavigation}</div>
        <div>{content}</div>
      </div>
    ) : null,
}));

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

  it("closes the modal when the view requests it", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Close preferences" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false);
    });
  });

  it("passes fetched accounts into the accounts navigation slot", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
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
    usePreferencesStore.setState({ prefs: { reader_view: "widescreen" }, loaded: true });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Default display mode" })).toHaveTextContent("Widescreen");
  });
});
