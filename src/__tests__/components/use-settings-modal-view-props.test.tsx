import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useSettingsModalViewProps } from "@/components/settings/hooks/use-settings-modal-view-props";

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
    "nav.debug": "Debug",
  };
  const t = (key: string) => labels[key] ?? key;

  it("orders settings categories by expected usage frequency", () => {
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: true,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
    });

    render(viewProps.navigation);

    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
      "General",
      "Reading",
      "Appearance",
      "Mute",
      "Tags",
      "Shortcuts",
      "Actions & Sharing",
      "Data Management",
      "Debug",
    ]);
  });

  it("omits the debug category outside development builds", () => {
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: false,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
    });

    render(viewProps.navigation);

    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
      "General",
      "Reading",
      "Appearance",
      "Mute",
      "Tags",
      "Shortcuts",
      "Actions & Sharing",
      "Data Management",
    ]);
  });

  it("locks category and account navigation while setup is in progress", async () => {
    const user = userEvent.setup();
    const setSettingsCategory = vi.fn();
    const openSettingsAccount = vi.fn();
    const openSettingsAddAccount = vi.fn();
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: false,
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

  it("builds structured content reset keys for account ids containing delimiters", () => {
    const viewProps = useSettingsModalViewProps({
      t,
      devBuild: false,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: "acc:add:FreshRss",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
    });
    const addAccountViewProps = useSettingsModalViewProps({
      t,
      devBuild: false,
      settingsOpen: true,
      settingsCategory: "general",
      settingsAccountId: "acc:add",
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
    });

    expect(JSON.parse(viewProps.contentResetKey ?? "")).toEqual({
      category: "general",
      accountId: "acc:add:FreshRss",
      mode: { type: "browse" },
    });
    expect(JSON.parse(addAccountViewProps.contentResetKey ?? "")).toEqual({
      category: "general",
      accountId: "acc:add",
      mode: { type: "add", initialKind: "FreshRss" },
    });
    expect(viewProps.contentResetKey).not.toBe(addAccountViewProps.contentResetKey);
  });

  it("changes content reset keys only when the routed content identity changes", () => {
    const baseProps = {
      t,
      devBuild: false,
      settingsOpen: true,
      settingsCategory: "general" as const,
      settingsAccountId: null,
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
      settingsLoading: false,
      accounts: [],
      content: <div>Settings content</div>,
      closeSettings: vi.fn(),
      openSettings: vi.fn(),
      setSettingsCategory: vi.fn(),
      openSettingsAccount: vi.fn(),
      openSettingsAddAccount: vi.fn(),
    };

    const generalKey = useSettingsModalViewProps(baseProps).contentResetKey;
    const loadingKey = useSettingsModalViewProps({ ...baseProps, settingsLoading: true }).contentResetKey;
    const accountKey = useSettingsModalViewProps({ ...baseProps, settingsAccountId: "acc-1" }).contentResetKey;
    const addPickKey = useSettingsModalViewProps({ ...baseProps, settingsAddAccount: true }).contentResetKey;
    const addFreshRssKey = useSettingsModalViewProps({
      ...baseProps,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    }).contentResetKey;

    expect(loadingKey).toBe(generalKey);
    expect(accountKey).not.toBe(generalKey);
    expect(addPickKey).not.toBe(generalKey);
    expect(addFreshRssKey).not.toBe(addPickKey);
  });
});
