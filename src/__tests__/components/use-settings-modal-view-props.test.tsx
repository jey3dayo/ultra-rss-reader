import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useSettingsModalViewProps } from "@/components/settings/hooks/use-settings-modal-view-props";

const accountFixture = {
  id: "acc-1",
  name: "FreshRSS",
  kind: "FreshRss",
  username: "alice",
  server_url: "https://freshrss.example.com",
  sync_interval_secs: 3600,
  sync_on_startup: true,
  sync_on_wake: false,
  keep_read_items_days: 30,
};

describe("useSettingsModalViewProps", () => {
  const labels: Record<string, string> = {
    preferences: "Settings",
    close_preferences: "Close settings",
    accounts_heading: "Accounts",
    add_account_ellipsis: "Add account…",
    "nav.general": "General",
    "nav.reading": "Reading",
    "nav.appearance": "Appearance",
    "nav.mute": "Mute",
    "nav.tags": "Tags",
    "nav.shortcuts": "Shortcuts",
    "nav.actions": "Actions & Sharing",
    "nav.data": "Data Management",
    "nav.debug": "Development",
  };
  const t = (key: string) => labels[key] ?? key;

  it("locks category and account navigation while setup is in progress", async () => {
    const user = userEvent.setup();
    const setSettingsCategory = vi.fn();
    const openSettingsAccount = vi.fn();
    const openSettingsAddAccount = vi.fn();
    const viewProps = useSettingsModalViewProps({
      t,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: "acc-1",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [
        {
          id: "acc-1",
          name: "FreshRSS",
          kind: "FreshRss",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        },
      ],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory,
      openSettingsAccount,
      openSettingsAddAccount,
      setupLockReason: "Finish setup",
    });

    expect(viewProps.lockMessage).toBe("Finish setup");

    render(
      <div>
        {viewProps.navigation}
        {viewProps.accountsNavigation}
      </div>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);

    await user.click(screen.getByRole("button", { name: "Reading" }));
    await user.click(screen.getByRole("button", { name: "FreshRSS" }));
    await user.click(screen.getByRole("button", { name: "Add account…" }));

    expect(setSettingsCategory).not.toHaveBeenCalled();
    expect(openSettingsAccount).not.toHaveBeenCalled();
    expect(openSettingsAddAccount).not.toHaveBeenCalled();
  });
});

describe("useSettingsModalViewProps leave guard", () => {
  const labels: Record<string, string> = {
    preferences: "Settings",
    close_preferences: "Close settings",
    accounts_heading: "Accounts",
    add_account_ellipsis: "Add account…",
    "nav.general": "General",
    "nav.reading": "Reading",
    "nav.appearance": "Appearance",
  };
  const t = (key: string) => labels[key] ?? key;

  const buildViewProps = (
    overrides: Partial<
      Pick<
        Parameters<typeof useSettingsModalViewProps>[0],
        | "guardLeave"
        | "leaveConfirmation"
        | "accounts"
        | "closeSettings"
        | "setSettingsCategory"
        | "openSettingsAccount"
        | "openSettingsAddAccount"
      >
    > = {},
  ) =>
    useSettingsModalViewProps({
      t,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: "acc-1",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [accountFixture],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
      ...overrides,
    });

  it("routes onClose through guardLeave and executes the leave callback", () => {
    const closeSettings = vi.fn();
    const guardLeave = vi.fn((leave: () => void) => leave());
    const viewProps = buildViewProps({ closeSettings, guardLeave });

    viewProps.onClose();

    expect(guardLeave).toHaveBeenCalledTimes(1);
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it("routes onOpenChange(false) through guardLeave and executes the leave callback", () => {
    const closeSettings = vi.fn();
    const guardLeave = vi.fn((leave: () => void) => leave());
    const viewProps = buildViewProps({ closeSettings, guardLeave });

    viewProps.onOpenChange(false);

    expect(guardLeave).toHaveBeenCalledTimes(1);
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it("routes selecting a different category through guardLeave", async () => {
    const user = userEvent.setup();
    const setSettingsCategory = vi.fn();
    const guardLeave = vi.fn((leave: () => void) => leave());
    const viewProps = buildViewProps({ setSettingsCategory, guardLeave });

    render(
      <div>
        {viewProps.navigation}
        {viewProps.accountsNavigation}
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Appearance" }));

    expect(guardLeave).toHaveBeenCalledTimes(1);
    expect(setSettingsCategory).toHaveBeenCalledWith("appearance");
  });

  it("routes selecting a different account through guardLeave", async () => {
    const user = userEvent.setup();
    const openSettingsAccount = vi.fn();
    const guardLeave = vi.fn((leave: () => void) => leave());
    const viewProps = buildViewProps({
      openSettingsAccount,
      guardLeave,
      accounts: [accountFixture, { ...accountFixture, id: "acc-2", name: "Local" }],
    });

    render(<div>{viewProps.accountsNavigation}</div>);
    await user.click(screen.getByRole("button", { name: /Local/i }));

    expect(guardLeave).toHaveBeenCalledTimes(1);
    expect(openSettingsAccount).toHaveBeenCalledWith("acc-2");
  });

  it("routes add account through guardLeave", async () => {
    const user = userEvent.setup();
    const openSettingsAddAccount = vi.fn();
    const guardLeave = vi.fn((leave: () => void) => leave());
    const viewProps = buildViewProps({ openSettingsAddAccount, guardLeave });

    render(<div>{viewProps.accountsNavigation}</div>);
    await user.click(screen.getByRole("button", { name: "Add account…" }));

    expect(guardLeave).toHaveBeenCalledTimes(1);
    expect(openSettingsAddAccount).toHaveBeenCalledTimes(1);
  });

  it("selecting the current account opens it directly without guardLeave", async () => {
    const user = userEvent.setup();
    const openSettingsAccount = vi.fn();
    const guardLeave = vi.fn();
    const viewProps = buildViewProps({ openSettingsAccount, guardLeave });

    render(<div>{viewProps.accountsNavigation}</div>);
    await user.click(screen.getByRole("button", { name: "FreshRSS" }));

    expect(guardLeave).not.toHaveBeenCalled();
    expect(openSettingsAccount).toHaveBeenCalledWith("acc-1");
  });

  it("passes leaveConfirmation through to the view props", () => {
    const leaveConfirmation = <span>unsaved changes confirm</span>;
    const viewProps = buildViewProps({ leaveConfirmation });

    expect(viewProps.leaveConfirmation).toBe(leaveConfirmation);
  });
});
