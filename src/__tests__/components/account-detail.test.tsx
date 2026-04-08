import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetail } from "@/components/settings/account-detail";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const accountDetailViewSpy = vi.fn();

vi.mock("@/components/settings/account-detail-view", () => ({
  AccountDetailView: (props: {
    credentialsSection?: ReactNode;
    syncSection: {
      isSyncing?: boolean;
      syncNowLabel?: string;
      syncingLabel?: string;
      onSyncNow?: () => void;
      keepReadItems: {
        options: Array<{ value: string; label: string }>;
        onChange: (value: string) => void;
      };
    };
  }) => {
    accountDetailViewSpy(props);

    return (
      <div>
        {props.credentialsSection}
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
      </div>
    );
  },
}));

describe("AccountDetail", () => {
  beforeEach(async () => {
    accountDetailViewSpy.mockClear();
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
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
          syncOnWake: false,
          keepReadItemsDays: 60,
        },
      });
    });

    expect(accountDetailViewSpy).toHaveBeenCalled();
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
});
