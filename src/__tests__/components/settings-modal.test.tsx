import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SettingsModal } from "@/components/settings/settings-modal";
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

  it("renders fetched accounts in the accounts navigation", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
  });
});
