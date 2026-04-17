import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetail } from "@/components/settings/account-detail";
import i18n from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const accountDetailViewSpy = vi.fn();

vi.mock("@/components/settings/account-detail-view", () => ({
  AccountDetailView: (props: {
    title: string;
    generalSection: {
      nameValue: string;
      isEditingName: boolean;
      nameDraft: string;
      nameInputRef?: React.RefObject<HTMLInputElement | null>;
      onStartEditingName: () => void;
      onNameDraftChange: (value: string) => void;
      onCommitName: () => void;
      onNameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    };
    credentialsSection?: ReactNode;
    syncSection: {
      isSyncing?: boolean;
      syncNowLabel?: string;
      syncingLabel?: string;
      onSyncNow?: () => void;
      statusRows?: Array<{ label: string; value: string }>;
      syncOnStartup: {
        onChange: (checked: boolean) => void;
      };
      keepReadItems: {
        options: Array<{ value: string; label: string }>;
        onChange: (value: string) => void;
      };
    };
  }) => {
    accountDetailViewSpy(props);

    return (
      <div>
        <h2>{props.title}</h2>
        {props.generalSection.isEditingName ? (
          <input
            aria-label="Account name"
            ref={props.generalSection.nameInputRef}
            value={props.generalSection.nameDraft}
            onChange={(event) => props.generalSection.onNameDraftChange(event.target.value)}
            onBlur={props.generalSection.onCommitName}
            onKeyDown={props.generalSection.onNameKeyDown}
          />
        ) : (
          <button type="button" onClick={props.generalSection.onStartEditingName}>
            {props.generalSection.nameValue}
          </button>
        )}
        {props.credentialsSection}
        <button type="button" onClick={() => props.syncSection.syncOnStartup.onChange(true)}>
          Enable startup sync
        </button>
        <button type="button" onClick={() => props.syncSection.keepReadItems.onChange("60")}>
          Select 60 days
        </button>
        {props.syncSection.onSyncNow && (
          <button type="button" onClick={props.syncSection.onSyncNow} disabled={props.syncSection.isSyncing}>
            {props.syncSection.isSyncing ? props.syncSection.syncingLabel : props.syncSection.syncNowLabel}
          </button>
        )}
        <ul>
          {props.syncSection.keepReadItems.options.map((option) => (
            <li key={option.value}>{option.label}</li>
          ))}
        </ul>
        <dl>
          {props.syncSection.statusRows?.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  },
}));

describe("AccountDetail", () => {
  beforeEach(async () => {
    accountDetailViewSpy.mockClear();
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ settingsAccountId: "acc-1" });
  });

  it("offers a 60 day retention option and persists it through update_account_sync", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "Local",
              name: "Local",
              username: null,
              server_url: null,
              sync_interval_secs: 3600,
              sync_on_startup: false,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "update_account_sync":
          return {
            id: "acc-1",
            kind: "Local",
            name: "Local",
            username: null,
            server_url: null,
            sync_interval_secs: Number(args.syncIntervalSecs),
            sync_on_startup: Boolean(args.syncOnStartup),
            sync_on_wake: Boolean(args.syncOnWake),
            keep_read_items_days: Number(args.keepReadItemsDays),
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByText("60 days")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select 60 days" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_account_sync",
        args: {
          accountId: "acc-1",
          syncIntervalSecs: 3600,
          syncOnStartup: false,
          syncOnWake: false,
          keepReadItemsDays: 60,
        },
      });
    });

    expect(accountDetailViewSpy).toHaveBeenCalled();
  });

  it("persists the startup sync toggle through update_account_sync", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "Local",
              name: "Local",
              username: null,
              server_url: null,
              sync_interval_secs: 3600,
              sync_on_startup: false,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "update_account_sync":
          return {
            id: "acc-1",
            kind: "Local",
            name: "Local",
            username: null,
            server_url: null,
            sync_interval_secs: Number(args.syncIntervalSecs),
            sync_on_startup: Boolean(args.syncOnStartup),
            sync_on_wake: Boolean(args.syncOnWake),
            keep_read_items_days: Number(args.keepReadItemsDays),
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Enable startup sync" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_account_sync",
        args: {
          accountId: "acc-1",
          syncIntervalSecs: 3600,
          syncOnStartup: true,
          syncOnWake: false,
          keepReadItemsDays: 30,
        },
      });
    });
  });

  it("marks the sync section as syncing while global sync progress is active", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "Local",
            name: "Local",
            username: null,
            server_url: null,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ];
      }
      return null;
    });

    useUiStore.setState({
      syncProgress: {
        active: true,
        kind: "manual_all",
        total: 2,
        completed: 1,
        activeAccountIds: new Set(),
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(accountDetailViewSpy).toHaveBeenCalled();
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.isSyncing).toBe(true);
    });
  });

  it("shows scheduler retry details in the sync section when the account is in backoff", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "FreshRss",
            name: "FreshRSS",
            username: "user",
            server_url: "https://freshrss.example.com",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ];
      }
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: "2026-04-13T03:00:00Z",
          last_error: "Network timeout",
          error_count: 2,
          next_retry_at: "2026-04-13T03:15:00Z",
        };
      }
      return null;
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.statusRows).toEqual([
        expect.objectContaining({ label: "Next automatic retry", value: expect.any(String) }),
        { label: "Consecutive sync failures", value: "2 failures" },
        { label: "Last sync error", value: "Network timeout" },
      ]);
    });
  });

  it("refreshes the sync status after a successful manual sync", async () => {
    const user = userEvent.setup();
    let statusCallCount = 0;

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "get_account_sync_status":
          statusCallCount += 1;
          return statusCallCount === 1
            ? {
                last_success_at: "2026-04-13T03:00:00Z",
                last_error: "Network timeout",
                error_count: 2,
                next_retry_at: "2026-04-13T03:15:00Z",
              }
            : {
                last_success_at: "2026-04-13T03:20:00Z",
                last_error: null,
                error_count: 0,
                next_retry_at: null,
              };
        case "trigger_sync_account":
          return {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: [],
            warnings: [],
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const firstResolvedCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(firstResolvedCall?.[0].syncSection.statusRows).toEqual(
        expect.arrayContaining([expect.objectContaining({ label: "Last sync error", value: "Network timeout" })]),
      );
    });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.statusRows).toEqual([]);
    });
    expect(statusCallCount).toBeGreaterThanOrEqual(2);
  });

  it("marks the sync section as syncing for the active manual account", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "Local",
            name: "Local",
            username: null,
            server_url: null,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ];
      }
      return null;
    });

    useUiStore.setState({
      syncProgress: {
        active: true,
        kind: "manual_account",
        total: 1,
        completed: 0,
        activeAccountIds: new Set(["acc-1"]),
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.isSyncing).toBe(true);
    });
  });

  it("waits for credential persistence before testing the connection", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let resolveCredentialSave: (() => void) | undefined;

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "update_account_credentials":
          return new Promise((resolve) => {
            resolveCredentialSave = () =>
              resolve({
                id: "acc-1",
                kind: "FreshRss",
                name: "FreshRSS",
                username: "user",
                server_url: "https://freshrss.example.com",
                sync_interval_secs: 3600,
                sync_on_startup: true,
                sync_on_wake: false,
                keep_read_items_days: 30,
              });
          });
        case "test_account_connection":
          return true;
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const passwordInput = (await screen.findByPlaceholderText("Enter new password")) as HTMLInputElement;
    expect(passwordInput).toHaveValue("");
    await user.click(passwordInput);
    await user.type(passwordInput, "new-secret");

    const clickPromise = user.click(screen.getByRole("button", { name: "Test Connection" }));

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "update_account_credentials")).toHaveLength(1);
    });
    expect(calls.some((call) => call.cmd === "test_account_connection")).toBe(false);
    expect(useUiStore.getState().settingsLoading).toBe(false);

    if (!resolveCredentialSave) {
      throw new Error("credential save promise was never created");
    }
    resolveCredentialSave();
    await clickPromise;

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "test_account_connection")).toHaveLength(1);
    });
  });

  it("shows Inoreader app credential fields and the shared note", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "Inoreader",
            name: "Inoreader",
            username: "alice@example.com",
            server_url: null,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ];
      }
      return null;
    });

    usePreferencesStore.setState({
      prefs: {
        inoreader_app_id: "saved-app-id",
        inoreader_app_key: "saved-app-key",
      },
      loaded: true,
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByDisplayValue("saved-app-id")).toBeInTheDocument();
    expect(screen.getByDisplayValue("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("alice@example.com");
    expect(screen.getByText("App ID and App Key apply to all Inoreader accounts.")).toBeInTheDocument();
  });

  it("saves Inoreader app credentials before the account credentials and connection test", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "Inoreader",
              name: "Inoreader",
              username: "alice@example.com",
              server_url: null,
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "set_preference":
          return null;
        case "update_account_credentials":
          return {
            id: "acc-1",
            kind: "Inoreader",
            name: "Inoreader",
            username: "new@example.com",
            server_url: null,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          };
        case "test_account_connection":
          return true;
        default:
          return null;
      }
    });

    usePreferencesStore.setState({
      prefs: {
        inoreader_app_id: "saved-app-id",
        inoreader_app_key: "saved-app-key",
      },
      loaded: true,
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const appIdInput = (await screen.findByDisplayValue("saved-app-id")) as HTMLInputElement;
    const appKeyInput = screen.getAllByDisplayValue("••••••••")[0] as HTMLInputElement;
    const emailInput = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;

    await user.clear(appIdInput);
    await user.type(appIdInput, "fresh-app-id");
    appIdInput.blur();

    await user.click(appKeyInput);
    await waitFor(() => {
      expect(appKeyInput).toHaveValue("");
    });
    await user.type(appKeyInput, "fresh-app-key");
    appKeyInput.blur();

    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");
    emailInput.blur();

    await user.click(screen.getByRole("button", { name: "Test Connection" }));

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "test_account_connection")).toHaveLength(1);
    });

    expect(calls.filter((call) => call.cmd !== "get_account_sync_status").map((call) => call.cmd)).toEqual([
      "list_accounts",
      "set_preference",
      "set_preference",
      "update_account_credentials",
      "test_account_connection",
    ]);
  });

  it("shows a masked password after credential changes are saved", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "update_account_credentials":
          return {
            id: "acc-1",
            kind: "FreshRss",
            name: "FreshRSS",
            username: "user",
            server_url: "https://freshrss.example.com",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const passwordInput = (await screen.findByPlaceholderText("Enter new password")) as HTMLInputElement;
    await user.click(passwordInput);
    await user.type(passwordInput, "new-secret");
    passwordInput.blur();

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "update_account_credentials")).toHaveLength(1);
      expect(passwordInput).toHaveValue("••••••••");
    });

    await user.click(passwordInput);
    await waitFor(() => {
      expect(passwordInput).toHaveValue("");
    });
  });

  it("treats an unsuccessful connection test result as a failure toast", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "test_account_connection":
          return false;
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Test Connection" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).not.toBeNull();
    });
    expect(useUiStore.getState().toastMessage?.message).toContain("Connection failed");
    expect(useUiStore.getState().toastMessage?.message).not.toBe("Connection successful");
  });

  it("copies the server URL from account credentials", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "copy_to_clipboard":
          return null;
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Copy Server URL" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "copy_to_clipboard",
        args: { text: "https://freshrss.example.com" },
      });
    });
  });

  it("shows a warning toast when account sync completes with anomalies", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "trigger_sync_account":
          return {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: [],
            warnings: [{ account_id: "acc-1", account_name: "FreshRSS", message: "Skipped 3 entries." }],
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed with warnings",
      });
    });
  });

  it("shows a retry-pending toast when account sync queues another attempt", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "trigger_sync_account":
          return {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: [],
            warnings: [
              {
                account_id: "acc-1",
                account_name: "FreshRSS",
                message: "Local change will retry on the next sync.",
                kind: "retry_pending",
              },
            ],
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed, but some changes will retry next sync",
      });
    });
  });

  it("does not toggle settings-wide loading for manual account sync", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "trigger_sync_account":
          return {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: [],
            warnings: [],
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));

    expect(useUiStore.getState().settingsLoading).toBe(false);
  });

  it("uses the localized server heading for FreshRSS credentials", async () => {
    await i18n.changeLanguage("ja");

    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "FreshRss",
            name: "FreshRSS",
            username: "user",
            server_url: "https://freshrss.example.com",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ];
      }
      return null;
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { level: 3, name: "サーバー" })).toBeInTheDocument();
  });

  it("renames the account and updates the visible title", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let accountName = "FreshRSS";

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: accountName,
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "rename_account":
          accountName = String(args.name);
          return {
            id: "acc-1",
            kind: "FreshRss",
            name: accountName,
            username: "user",
            server_url: "https://freshrss.example.com",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          };
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "FreshRSS" }));
    const input = await screen.findByRole("textbox", { name: "Account name" });
    await user.clear(input);
    await user.type(input, "Team FreshRSS");
    fireEvent.blur(input);

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "rename_account",
        args: { accountId: "acc-1", name: "Team FreshRSS" },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Team FreshRSS" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Team FreshRSS" })).toBeInTheDocument();
    });
  });
});
