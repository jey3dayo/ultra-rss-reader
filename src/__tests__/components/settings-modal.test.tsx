import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts, type sampleTags } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModal } from "@/components/settings/settings-modal";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal-view";
import i18n from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

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
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ pendingPreferenceSaves: 0 });
    useUiStore.getState().openSettings();
    setupTauriMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("closes the modal when the view requests it", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Close settings" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false);
    });
  });

  it("keeps open modal chrome on one locale while language changes", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close settings" })).toBeInTheDocument();

    await i18n.changeLanguage("ja");

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close settings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "環境設定" })).not.toBeInTheDocument();
  });

  it("locks close and navigation while preference saves are pending", async () => {
    const user = userEvent.setup();
    usePreferencesStore.setState({ pendingPreferenceSaves: 1 });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Close settings" }));
    await user.click(screen.getByRole("button", { name: "Reading" }));

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        settingsOpen: true,
        settingsCategory: "general",
      }),
    );
    expect(screen.getByRole("button", { name: "Reading" })).toBeDisabled();
  });

  it("passes fetched accounts into the accounts navigation slot", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
  });

  it("opens account detail when selecting an account from general settings", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    const accountButtons = await screen.findAllByRole("button", {
      name: /FreshRSS/i,
    });
    await user.click(accountButtons[accountButtons.length - 1] ?? accountButtons[0]);

    await waitFor(() => {
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
  });

  it("keeps modal open, category selection, and account navigation transitions stable", async () => {
    const user = userEvent.setup();

    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-2" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState()).toEqual(
        expect.objectContaining({
          settingsOpen: true,
          settingsCategory: "accounts",
          settingsAccountId: "acc-2",
          settingsAddAccount: false,
          settingsAddAccountInitialKind: null,
        }),
      );
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^(Reading|nav\.reading)$/ }));

    await waitFor(() => {
      expect(useUiStore.getState()).toEqual(
        expect.objectContaining({
          settingsOpen: true,
          settingsCategory: "reading",
          settingsAccountId: null,
          settingsAddAccount: false,
          settingsAddAccountInitialKind: null,
        }),
      );
    });

    expect(screen.queryByTestId("account-detail-layout")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /FreshRSS/i }));

    await waitFor(() => {
      expect(useUiStore.getState()).toEqual(
        expect.objectContaining({
          settingsOpen: true,
          settingsCategory: "accounts",
          settingsAccountId: "acc-2",
          settingsAddAccount: false,
          settingsAddAccountInitialKind: null,
        }),
      );
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
  });

  it("clears account navigation state when switching from account detail to a settings category", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    const accountButtons = await screen.findAllByRole("button", {
      name: /FreshRSS/i,
    });
    await user.click(accountButtons[accountButtons.length - 1] ?? accountButtons[0]);

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    await user.click(screen.getByRole("button", { name: /^(Reading|nav\.reading)$/ }));

    await waitFor(() => {
      expect(useUiStore.getState()).toEqual(
        expect.objectContaining({
          settingsCategory: "reading",
          settingsAccountId: null,
          settingsAddAccount: false,
          settingsAddAccountInitialKind: null,
        }),
      );
    });

    expect(screen.queryByTestId("account-detail-layout")).not.toBeInTheDocument();
  });

  it("opens add account form when selecting add account from general settings", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    const addAccountButtons = await screen.findAllByRole("button", {
      name: /Add account/i,
    });
    await user.click(addAccountButtons[addAccountButtons.length - 1] ?? addAccountButtons[0]);

    await waitFor(() => {
      expect(useUiStore.getState().settingsCategory).toBe("accounts");
      expect(useUiStore.getState().settingsAddAccount).toBe(true);
    });

    expect(screen.getByRole("heading", { level: 2, name: /Add Account/i })).toBeInTheDocument();
  });

  it("opens the FreshRSS config form directly when an initial provider is preset", async () => {
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: null,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.queryByText("Local Feeds")).not.toBeInTheDocument();
  });

  it("prefers the active setup account detail over the add-account top screen", async () => {
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: null,
      settingsAddAccount: true,
      accountSetupSession: {
        accountId: "acc-2",
        owner: "add-account",
        state: "syncing",
      },
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
      expect(useUiStore.getState().settingsAddAccount).toBe(false);
    });

    expect(await screen.findByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /Add Account/i })).not.toBeInTheDocument();
  });

  it("locks settings navigation while add-account credential verification is pending", async () => {
    const user = userEvent.setup();
    let resolveAddAccount: ((value: unknown) => void) | undefined;

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return new Promise((resolve) => {
          resolveAddAccount = resolve;
        });
      }
      return undefined;
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: null,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: "FreshRss",
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.type(await screen.findByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toEqual({
        owner: "add-account",
        state: "verifying",
      });
    });

    await user.click(screen.getByRole("button", { name: "Close settings" }));
    await user.click(screen.getByRole("button", { name: "Reading" }));
    await user.click(screen.getByRole("button", { name: /FreshRSS/i }));

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAccountId: null,
        settingsAddAccount: true,
      }),
    );
    expect(screen.getByRole("button", { name: "Reading" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeDisabled();

    resolveAddAccount?.({
      ...sampleAccounts[1],
      id: "acc-new",
      kind: "FreshRss",
      name: "FreshRSS",
      username: "alice",
      server_url: "https://freshrss.example.com",
      sync_interval_secs: 3600,
      sync_on_startup: true,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });
  });

  it("shows the mute settings category in navigation", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_mute_keywords") {
        return [];
      }
      return undefined;
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Mute" })).toBeInTheDocument();
  });

  it("shows the tags settings category in navigation", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_tags") {
        return [];
      }
      return undefined;
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Tags" })).toBeInTheDocument();
  });

  it("renders the shortcuts category with an svg icon", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    const shortcutsButton = await screen.findByRole("button", {
      name: /Shortcuts/i,
    });

    expect(shortcutsButton.querySelector("svg")).not.toBeNull();
    expect(shortcutsButton).not.toHaveTextContent("⌘");
  });

  it("switches to mute settings and shows the empty state", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      if (cmd === "list_mute_keywords") {
        return [];
      }
      return undefined;
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Mute" }));

    expect(await screen.findByText("No mute keywords yet.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Keyword" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Auto mark as read/ })).toHaveAttribute("aria-checked", "false");
  });

  it("toggles mute auto mark as read with the dedicated command", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "list_mute_keywords") {
        return [];
      }
      if (cmd === "set_mute_auto_mark_read") {
        return null;
      }
      return undefined;
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Mute" }));
    await user.click(screen.getByRole("switch", { name: /Auto mark as read/ }));

    expect(calls).toContainEqual({
      cmd: "set_mute_auto_mark_read",
      args: { enabled: true },
    });
  });

  it("shows saved mute keywords with editable scope select", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Mute" }));

    expect(screen.getByRole("combobox", { name: "Scope for Kindle Unlimited" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("switches to tags settings and creates a tag from the add row", async () => {
    const user = userEvent.setup();
    let mockTags: typeof sampleTags = [];

    setupTauriMocks((cmd, args) => {
      if (cmd === "list_tags") {
        return mockTags;
      }
      if (cmd === "create_tag") {
        const nextTag = {
          id: "tag-created",
          name: "Later",
          color: typeof args.color === "string" ? args.color : null,
        };
        mockTags = [nextTag];
        return nextTag;
      }
      return undefined;
    });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Tags" }));

    expect(await screen.findByText("No tags yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Color")).toHaveLength(1);
    const nameInput = screen.getByRole("textbox", { name: "Tag name" });
    const createButton = screen.getByRole("button", { name: "Create" });

    expect(nameInput).toBeInTheDocument();
    expect(createButton).toBeDisabled();

    await user.type(nameInput, "Later");
    await user.click(screen.getByRole("radio", { name: "Color #6f8eb8" }));

    expect(createButton).toBeEnabled();

    await user.click(createButton);

    expect(await screen.findByText("Later")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-created")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-created")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-swatch-tag-created")).toBeNull();
    expect(nameInput).toHaveValue("");
  });

  it("renames and deletes saved tags while preserving color state", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Tags" }));

    expect(await screen.findByText("Tech")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-1")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-1")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-color-dot-tag-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-swatch-tag-1")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit Tech" }));

    const renameDialog = await screen.findByRole("dialog", {
      name: "Edit Tag",
    });
    const renameInput = within(renameDialog).getByRole("textbox", {
      name: "Name",
    });

    await user.clear(renameInput);
    await user.type(renameInput, "Tech News");
    await user.click(within(renameDialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Tech News")).toBeInTheDocument();
    expect(screen.queryByText("Tech")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Later" }));

    const deleteDialog = await screen.findByRole("dialog", {
      name: "Delete Tag",
    });
    await user.click(
      within(deleteDialog).getByRole("button", {
        name: 'Delete "Later". This cannot be undone.',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Later")).not.toBeInTheDocument();
    });
  });

  it("does not fall back to general settings on a cold accounts open while accounts are unresolved", () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return new Promise(() => {});
      }
      return null;
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(screen.queryByRole("switch", { name: "Show Unread" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("account-detail-layout")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add account/i })).toBeInTheDocument();
  });

  it("keeps account navigation and detail visible during reset and recovers stale selection to a valid account", async () => {
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    const { queryClient, wrapper } = createQueryWrapper();
    render(<SettingsModal />, { wrapper });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local/i })).toHaveClass("text-[var(--sidebar-selection-foreground)]");
    expect(screen.getByRole("button", { name: /FreshRSS/i })).not.toHaveClass(
      "text-[var(--sidebar-selection-foreground)]",
    );

    await act(async () => {
      queryClient?.setQueryData(queryKeys.accounts.root, undefined);
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();

    await act(async () => {
      queryClient?.setQueryData(queryKeys.accounts.root, [sampleAccounts[1]]);
    });

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toHaveClass("text-[var(--sidebar-selection-foreground)]");
  });

  it("hides an account that disappears by refetch before the adopted snapshot updates", async () => {
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    const { queryClient, wrapper } = createQueryWrapper();
    render(<SettingsModal />, { wrapper });

    expect(await screen.findByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();

    await act(async () => {
      queryClient?.setQueryData(queryKeys.accounts.root, [sampleAccounts[1]]);
    });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
  });

  it("does not keep showing a deleted account while accounts are pending after delete", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper();
    let listedAccounts = [...sampleAccounts];
    let pauseAccountsQuery = false;

    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return pauseAccountsQuery ? new Promise(() => {}) : listedAccounts;
      }
      if (cmd === "delete_account") {
        listedAccounts = [sampleAccounts[1]];
        pauseAccountsQuery = true;
        return null;
      }
      return null;
    });

    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(
      <>
        <SettingsModal />
        <AppConfirmDialog />
      </>,
      { wrapper },
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    const confirmDialog = await screen.findByRole("dialog", {
      name: "Confirm",
    });
    const confirmDeleteButton = within(confirmDialog).getByRole("button", {
      name: /^Delete\b/,
    });
    expect(confirmDeleteButton).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    await user.click(confirmDeleteButton);

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toHaveClass("text-[var(--sidebar-selection-foreground)]");

    await act(async () => {
      queryClient?.setQueryData(queryKeys.accounts.root, [sampleAccounts[1]]);
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
  });

  it("does not resurrect a deleted account when reopening the modal while accounts are still pending", async () => {
    const user = userEvent.setup();
    let listedAccounts = [...sampleAccounts];
    let pauseAccountsQuery = false;

    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return pauseAccountsQuery ? new Promise(() => {}) : listedAccounts;
      }
      if (cmd === "delete_account") {
        listedAccounts = [sampleAccounts[1]];
        pauseAccountsQuery = true;
        return null;
      }
      return null;
    });

    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(
      <>
        <SettingsModal />
        <AppConfirmDialog />
      </>,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    await user.click(
      within(await screen.findByRole("dialog", { name: "Confirm" })).getByRole("button", { name: /^Delete\b/ }),
    );

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    act(() => {
      useUiStore.getState().closeSettings();
    });

    act(() => {
      useUiStore.getState().openSettings("accounts");
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
  });

  it("prefers the saved account when opening the accounts section", async () => {
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-2" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });
  });

  it("shows the debug category in navigation outside development builds", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", false);

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Development" }));

    expect(screen.getByRole("button", { name: "Development" })).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: "Developer Mode" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Show layout HUD" })).not.toBeInTheDocument();
  });

  it("unlocks production-safe debug controls when developer mode is enabled", async () => {
    const user = userEvent.setup();
    vi.stubEnv("DEV", false);
    usePreferencesStore.setState({ prefs: { developer_mode: "true" }, loaded: true });

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Development" }));

    expect(await screen.findByRole("switch", { name: "Show layout HUD" })).toBeInTheDocument();
    expect(screen.queryByText("Developer Overlays")).not.toBeInTheDocument();
  });

  it("keeps direct debug selection on the debug page when developer mode is disabled", async () => {
    vi.stubEnv("DEV", true);
    usePreferencesStore.setState({ prefs: { developer_mode: "false" }, loaded: true });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("debug");

    render(<SettingsModal />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().settingsCategory).toBe("debug");
    });

    expect(screen.getByRole("button", { name: "Development" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Developer Mode" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Show layout HUD" })).not.toBeInTheDocument();
  });

  it("shows default enabled states in actions settings when preferences are unset", () => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    render(<ActionsSettings />, { wrapper: createWrapper() });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(1);
    expect(switches[0]).toBeChecked();
  });

  it("shows default display mode options in reading settings", () => {
    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "true" },
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Display when opening articles" })).toHaveTextContent(
      "Article text + Web Preview",
    );
  });

  it("opens the default display mode select on click during normal reading settings usage", async () => {
    const user = userEvent.setup();

    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    const combobox = screen.getByRole("combobox", {
      name: "Display when opening articles",
    });
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    await user.click(combobox);

    expect(await screen.findByRole("option", { name: "Article text only" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Article text + Web Preview" })).toBeInTheDocument();
    expect(combobox).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the default display mode select for the display-mode showcase intent", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_INTENT", "open-settings-reading-display-mode");
    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Display when opening articles" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(await screen.findByRole("option", { name: "Article text only" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Article text + Web Preview" })).toBeInTheDocument();
  });

  it("renders and updates the auto-open-first-article reading switch", async () => {
    const user = userEvent.setup();

    usePreferencesStore.setState({
      prefs: {},
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    const autoOpenSwitch = screen.getByRole("switch", {
      name: "Open the first article when selecting a feed",
    });
    expect(autoOpenSwitch).not.toBeChecked();

    await user.click(autoOpenSwitch);

    expect(usePreferencesStore.getState().prefs.open_first_article_on_feed_selection).toBe("true");
  });

  it("renders recent history clearing without a history recording preference", () => {
    usePreferencesStore.setState({
      prefs: {},
      loaded: true,
    });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "account-1",
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.queryByRole("switch", { name: "Record recently viewed articles" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Clear recently viewed history for the current account. This cannot be undone.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", {
        name: "Open the first article when selecting a feed",
      }),
    ).toBeInTheDocument();
  });
});
