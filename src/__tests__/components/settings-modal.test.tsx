import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "@/components/settings/settings-modal";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

type SettingsModalViewProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  navigation: ReactNode;
  accountsNavigation: ReactNode;
  content: ReactNode;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};

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
});
