import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import i18n from "@tests/helpers/i18n-setup";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountDetail } from "@/components/settings/account-detail";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { i18nResourceLocales } from "@/lib/i18n-resources";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type AccountDetailViewMockProps = {
  title: string;
  subtitle?: string;
  headerSummary?: ReactNode;
  generalSection: {
    nameValue: string;
    disabled?: boolean;
    isEditingName: boolean;
    nameDraft: string;
    infoRows?: Array<{ label: string; value: string }>;
    nameInputRef?: React.RefObject<HTMLInputElement | null>;
    onStartEditingName: () => void;
    onNameDraftChange: (value: string) => void;
    onCommitName: () => void;
    onNameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  };
  credentialsSection?: ReactNode;
  syncSection: {
    heading: string;
    note?: string;
    isSyncing?: boolean;
    progressLabel?: string;
    progressValue?: number | null;
    progressCurrentLabel?: string;
    syncNowLabel?: string;
    syncingLabel?: string;
    onSyncNow?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    devCredentialsRecoveryActionLabel?: string;
    devCredentialsRecoveryLoadingLabel?: string;
    onDevCredentialsRecoveryAction?: () => void;
    isDevCredentialsRecoveryInFlight?: boolean;
    statusRows?: Array<{ label: string; value: string }>;
    syncOnStartup: {
      onChange: (checked: boolean) => void;
      disabled?: boolean;
    };
    keepReadItems: {
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
      disabled?: boolean;
    };
  };
  dangerZone: {
    importLabel: string;
    exportLabel: string;
    onImport: (file: File) => Promise<void>;
    onExport: () => void;
    disabled?: boolean;
  };
};

const accountDetailViewSpy = vi.fn<(props: AccountDetailViewMockProps) => void>();
const accountDetailCopyFailureLocaleMessages = {
  en: "Failed to copy server URL: Clipboard unavailable",
  ja: "サーバーURLのコピーに失敗しました: Clipboard unavailable",
} satisfies Record<(typeof i18nResourceLocales)[number], string>;
const accountDetailCopyFailureLocaleCases = i18nResourceLocales.map(
  (language) => [language, accountDetailCopyFailureLocaleMessages[language]] as const,
);

async function findPasswordInput() {
  const input = await screen.findByPlaceholderText("Enter new password");

  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected password field to be an input element");
  }

  return input;
}

vi.mock("@/components/settings/account-detail/view", () => ({
  AccountDetailView: (props: AccountDetailViewMockProps) => {
    accountDetailViewSpy(props);

    return (
      <div>
        <h2>{props.title}</h2>
        {props.headerSummary}
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
          <button
            type="button"
            onClick={props.generalSection.onStartEditingName}
            disabled={props.generalSection.disabled}
          >
            {props.generalSection.nameValue}
          </button>
        )}
        {props.credentialsSection}
        <div>{props.syncSection.heading}</div>
        {props.syncSection.note ? <p>{props.syncSection.note}</p> : null}
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
        {props.syncSection.onSecondaryAction && props.syncSection.secondaryActionLabel ? (
          <button type="button" onClick={props.syncSection.onSecondaryAction}>
            {props.syncSection.secondaryActionLabel}
          </button>
        ) : null}
        {props.syncSection.onDevCredentialsRecoveryAction && props.syncSection.devCredentialsRecoveryActionLabel ? (
          <button
            type="button"
            onClick={props.syncSection.onDevCredentialsRecoveryAction}
            disabled={props.syncSection.isDevCredentialsRecoveryInFlight}
          >
            {props.syncSection.isDevCredentialsRecoveryInFlight
              ? props.syncSection.devCredentialsRecoveryLoadingLabel
              : props.syncSection.devCredentialsRecoveryActionLabel}
          </button>
        ) : null}
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
          {props.generalSection.infoRows?.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <input
          data-testid="opml-import-input"
          type="file"
          accept=".opml,.xml"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              props.dangerZone.onImport(file);
            }
          }}
        />
        <button type="button" onClick={() => {}} disabled={props.dangerZone.disabled}>
          {props.dangerZone.importLabel}
        </button>
        <button type="button" onClick={props.dangerZone.onExport} disabled={props.dangerZone.disabled}>
          {props.dangerZone.exportLabel}
        </button>
      </div>
    );
  },
}));

async function findLatestImportHandler() {
  await waitFor(() => {
    expect(accountDetailViewSpy.mock.calls.at(-1)?.[0].dangerZone.onImport).toEqual(expect.any(Function));
  });

  const call = accountDetailViewSpy.mock.calls.at(-1);
  if (!call) {
    throw new Error("Expected account detail view props to be recorded");
  }

  return call[0].dangerZone.onImport;
}

describe("AccountDetail", () => {
  beforeEach(async () => {
    accountDetailViewSpy.mockClear();
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ settingsAccountId: "acc-1" });
  });

  it("keeps the account detail account contract schema-derived", () => {
    expectTypeOf<AccountDetailAccount>().toEqualTypeOf<AccountDto>();
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
          return undefined;
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
          return undefined;
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

  it("shows setup recovery choices as separate credential, server URL, and cache clear rows", async () => {
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

    useUiStore.setState({
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "failed",
        errorMessage: "Sync failed: unauthorized",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByText("Credential reset")).toBeInTheDocument();
    expect(screen.getByText("Server URL fix")).toBeInTheDocument();
    expect(screen.getByText("Cache clear")).toBeInTheDocument();
    expect(screen.getByText("Retry setup clears stale account status and feed cache first.")).toBeInTheDocument();
  });

  it("keeps malformed provider accounts visible as read-only quarantine state", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "DebugProvider",
            name: "Debug account",
            username: "debug-user",
            server_url: "not a url",
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

    expect(await screen.findByRole("button", { name: "Debug account" })).toBeDisabled();
    expect(screen.getByText("Configuration needs attention")).toBeInTheDocument();
    expect(screen.getByText("Quarantined")).toBeInTheDocument();
    expect(screen.getByText("Delete this account, then add it again.")).toBeInTheDocument();

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls.at(-1)?.[0];
      expect(lastCall?.subtitle).toBe("Unknown provider kind: DebugProvider");
      expect(lastCall?.syncSection.syncOnStartup.disabled).toBe(true);
      expect(lastCall?.syncSection.keepReadItems.disabled).toBe(true);
      expect(lastCall?.syncSection.onSyncNow).toBeUndefined();
      expect(lastCall?.dangerZone.disabled).toBe(false);
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
        sessionId: 1,
        kind: "manual_all",
        stage: "account_started",
        total: 2,
        completed: 1,
        currentAccountName: "Local",
        activeAccountIds: new Set(),
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(accountDetailViewSpy).toHaveBeenCalled();
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.isSyncing).toBe(true);
      expect(lastCall?.[0].syncSection.progressLabel).toBe("1 of 2 completed");
      expect(lastCall?.[0].syncSection.progressCurrentLabel).toBe("Syncing: Local");
    });
  });

  it("shows preparing progress text while setup sync has started but totals are not available yet", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return [
          {
            id: "acc-1",
            kind: "FreshRss",
            name: "debug",
            username: "debug",
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

    useUiStore.setState({
      syncProgress: {
        active: false,
        sessionId: null,
        kind: null,
        stage: null,
        total: 0,
        completed: 0,
        currentAccountName: null,
        activeAccountIds: new Set(),
      },
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "syncing",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.isSyncing).toBe(true);
      expect(lastCall?.[0].syncSection.progressLabel).toBe("Starting sync");
      expect(lastCall?.[0].syncSection.progressValue).toBeNull();
    });
  });

  it("does not start duplicate manual syncs while one is pending", async () => {
    const user = userEvent.setup();
    const syncCalls = vi.fn();
    let resolveSync: ((value: unknown) => void) | undefined;

    setupTauriMocks((cmd) => {
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
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "get_account_sync_status":
          return {
            last_success_at: null,
            last_error: null,
            error_count: 0,
            next_retry_at: null,
          };
        case "trigger_sync_account":
          syncCalls();
          return new Promise((resolve) => {
            resolveSync = resolve;
          });
        default:
          return null;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.dblClick(await screen.findByRole("button", { name: "Sync Now" }));

    expect(syncCalls).toHaveBeenCalledTimes(1);

    resolveSync?.({
      synced: true,
      total: 1,
      succeeded: 1,
      failed: [],
      warnings: [],
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
        expect.objectContaining({
          label: "Next automatic retry",
          value: expect.any(String),
        }),
        { label: "Consecutive sync failures", value: "2 failures" },
        { label: "Last sync error", value: "Network timeout" },
      ]);
    });
  });

  it("shows dev credential recovery only when dev file credentials failed because the store is oversized", async () => {
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
        case "get_platform_info":
          return {
            kind: "macos",
            capabilities: {
              supports_reading_list: true,
              supports_background_browser_open: true,
              supports_runtime_window_icon_replacement: true,
              supports_native_browser_navigation: true,
              uses_dev_file_credentials: true,
            },
          };
        case "get_account_sync_status":
          return {
            last_success_at: null,
            last_error:
              "Keychain error: Dev store exceeds maximum size of 65536 bytes Dev credential store may be corrupted or inaccessible.",
            error_count: 3,
            next_retry_at: null,
          };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Recover Dev credentials" })).toBeInTheDocument();
  });

  it("does not show dev credential recovery for native keyring oversized-looking errors", async () => {
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
          return {
            last_success_at: null,
            last_error: "Keychain error: Dev store exceeds maximum size of 65536 bytes",
            error_count: 3,
            next_retry_at: null,
          };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await screen.findByText("Last sync error");
    expect(screen.queryByRole("button", { name: "Recover Dev credentials" })).not.toBeInTheDocument();
  });

  it("calls the dev credential reset command from the sync error recovery action", async () => {
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
        case "get_platform_info":
          return {
            kind: "macos",
            capabilities: {
              supports_reading_list: true,
              supports_background_browser_open: true,
              supports_runtime_window_icon_replacement: true,
              supports_native_browser_navigation: true,
              uses_dev_file_credentials: true,
            },
          };
        case "get_account_sync_status":
          return {
            last_success_at: null,
            last_error:
              "Keychain error: Dev store exceeds maximum size of 65536 bytes Dev credential store may be corrupted or inaccessible.",
            error_count: 3,
            next_retry_at: null,
          };
        case "reset_oversized_dev_credentials_store":
          return true;
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Recover Dev credentials" }));

    await waitFor(() => {
      expect(calls.some((call) => call.cmd === "reset_oversized_dev_credentials_store")).toBe(true);
    });
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Dev credentials were moved aside. Restart the app and reconnect accounts.",
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
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const firstResolvedCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(firstResolvedCall?.[0].syncSection.statusRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "Last sync error",
            value: "Network timeout",
          }),
        ]),
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
        sessionId: 2,
        kind: "manual_account",
        stage: "account_started",
        total: 1,
        completed: 0,
        currentAccountName: "Local",
        activeAccountIds: new Set(["acc-1"]),
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await waitFor(() => {
      const lastCall = accountDetailViewSpy.mock.calls[accountDetailViewSpy.mock.calls.length - 1];
      expect(lastCall?.[0].syncSection.isSyncing).toBe(true);
    });
  });

  it("shows setup mode messaging while the first sync is in progress", async () => {
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

    useUiStore.setState({
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "syncing",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByText("Initial setup in progress")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We are finishing the first sync so this account is ready for the unread view. This screen cannot be closed until sync finishes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Setting up…" })).toBeDisabled();
  });

  it("shows retry and credential-edit actions after setup failure", async () => {
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

    useUiStore.setState({
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "failed",
        errorMessage: "Sync failed: Authentication failed",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByText("Could not finish setup")).toBeInTheDocument();
    expect(screen.getByText("Sync failed: Authentication failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit credentials" })).toBeInTheDocument();
  });

  it("closes settings and lands on unread after setup retry succeeds", async () => {
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
          return undefined;
      }
    });

    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-1",
      selectedAccountId: "acc-1",
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "failed",
        errorMessage: "Sync failed: Authentication failed",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Retry setup" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false);
      expect(useUiStore.getState().selection).toEqual({
        type: "smart",
        kind: "unread",
      });
      expect(useUiStore.getState().viewMode).toBe("unread");
      expect(useUiStore.getState().accountSetupSession).toBeNull();
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Setup complete",
      });
    });
  });

  it("waits for credential persistence before testing the connection", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const resolveCredentialSaves: Array<() => void> = [];

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
            resolveCredentialSaves.push(() =>
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
              }),
            );
          });
        case "test_account_connection":
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
            connection_verification_status: "verified",
            connection_verified_at: "2026-04-19T05:32:00Z",
            connection_verification_error: null,
          };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const passwordInput = await findPasswordInput();
    expect(passwordInput).toHaveValue("••••••••");
    await user.click(passwordInput);
    await user.type(passwordInput, "new-secret");

    const clickPromise = user.click(screen.getByRole("button", { name: "Test Connection" }));

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "update_account_credentials")).toHaveLength(1);
    });
    expect(calls.some((call) => call.cmd === "test_account_connection")).toBe(false);
    expect(useUiStore.getState().settingsLoading).toBe(false);

    if (!resolveCredentialSaves[0]) {
      throw new Error("credential save promise was never created");
    }
    resolveCredentialSaves[0]();
    await clickPromise;

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "test_account_connection")).toHaveLength(1);
    });
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
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const passwordInput = await findPasswordInput();
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

  it("keeps newer credential drafts when an older blur save finishes", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const resolveCredentialSaves: Array<() => void> = [];

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
            resolveCredentialSaves.push(() =>
              resolve({
                id: "acc-1",
                kind: "FreshRss",
                name: "FreshRSS",
                username: "saved-user",
                server_url: "https://saved.example.com",
                sync_interval_secs: 3600,
                sync_on_startup: true,
                sync_on_wake: false,
                keep_read_items_days: 30,
              }),
            );
          });
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const serverUrlInput = await screen.findByRole("textbox", {
      name: "Server URL",
    });
    await user.clear(serverUrlInput);
    await user.type(serverUrlInput, "https://first-draft.example.com");
    fireEvent.blur(serverUrlInput);

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "update_account_credentials")).toHaveLength(1);
    });

    await user.clear(serverUrlInput);
    await user.type(serverUrlInput, "https://second-draft.example.com");
    fireEvent.blur(serverUrlInput);
    await user.click(screen.getByRole("button", { name: "Copy Server URL" }));

    expect(calls).toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: "https://second-draft.example.com" },
    });

    if (!resolveCredentialSaves[0]) {
      throw new Error("credential save promise was never created");
    }
    resolveCredentialSaves[0]();

    await waitFor(() => {
      expect(calls.filter((call) => call.cmd === "update_account_credentials")).toHaveLength(2);
      expect(calls).toContainEqual({
        cmd: "update_account_credentials",
        args: expect.objectContaining({
          accountId: "acc-1",
          serverUrl: "https://second-draft.example.com",
          username: "user",
        }),
      });
      expect(serverUrlInput).toHaveValue("https://second-draft.example.com");
    });

    resolveCredentialSaves[1]?.();
  });

  it("shows the persisted connection summary for a verified FreshRSS account", async () => {
    const now = new Date();
    const localTodayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 6).toISOString();

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
              connection_verification_status: "verified",
              connection_verified_at: "2026-04-19T05:32:00Z",
              connection_verification_error: null,
            },
          ];
        case "get_account_sync_status":
          return {
            last_success_at: localTodayAt,
            last_error: null,
            error_count: 0,
            next_retry_at: null,
          };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByTestId("account-connection-summary")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("Today 01:06")).toBeInTheDocument();
    });
  });

  it("shows an auth-failure summary when verification has never succeeded", async () => {
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
              connection_verification_status: "error",
              connection_verified_at: null,
              connection_verification_error: "Authentication failed",
            },
          ];
        case "get_account_sync_status":
          return {
            last_success_at: null,
            last_error: null,
            error_count: 0,
            next_retry_at: null,
          };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    expect(await screen.findByTestId("account-connection-summary")).toBeInTheDocument();
    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("Authentication failed")).toBeInTheDocument();
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
          throw {
            type: "UserVisible",
            message: "Connection failed: connection could not be verified",
          };
        default:
          return undefined;
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

  it("does not start duplicate connection tests while one is pending", async () => {
    const user = userEvent.setup();
    const connectionTestCalls = vi.fn();
    let resolveConnectionTest: ((value: unknown) => void) | undefined;

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
          connectionTestCalls();
          return new Promise((resolve) => {
            resolveConnectionTest = resolve;
          });
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.dblClick(await screen.findByRole("button", { name: "Test Connection" }));

    expect(connectionTestCalls).toHaveBeenCalledTimes(1);

    resolveConnectionTest?.({
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
          return undefined;
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

  it("shows a failure toast without invoking clipboard when server URL is empty", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    useUiStore.setState({ showToast });

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
              server_url: "   ",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Copy Server URL" }));

    expect(calls.some((call) => call.cmd === "copy_to_clipboard")).toBe(false);
    expect(showToast).toHaveBeenCalledWith("Failed to copy server URL: Server URL is required");
  });

  it.each(
    accountDetailCopyFailureLocaleCases,
  )("wraps server URL copy failures in the %s locale toast", async (language, expectedMessage) => {
    await i18n.changeLanguage(language);
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

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
        case "copy_to_clipboard":
          throw { type: "UserVisible", message: "Clipboard unavailable" };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("settings:account.copy_server_url"),
      }),
    );

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(expectedMessage);
    });
    expect(showToast).not.toHaveBeenCalledWith("Clipboard unavailable");
  });

  it("revokes OPML export object URLs after download, before a rapid replacement, and on unmount", async () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

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
        case "export_opml":
          return '<opml version="2.0" />';
        default:
          return undefined;
      }
    });

    const { unmount } = render(<AccountDetail />, { wrapper: createWrapper() });
    const exportButton = await screen.findByRole("button", {
      name: "Export OPML",
    });

    fireEvent.click(exportButton);
    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
    });

    expect(revokeObjectUrl).not.toHaveBeenCalled();

    fireEvent.click(exportButton);
    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalledTimes(2);
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:first");

    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:second");
  });

  it("imports the selected OPML file into the current account and shows a success toast", async () => {
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
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "import_opml":
          return [];
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const onImport = await findLatestImportHandler();
    await act(async () => {
      await onImport(new File(['<opml version="2.0"><body /></opml>'], "feeds.opml", { type: "text/xml" }));
    });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "import_opml",
        args: {
          accountId: "acc-1",
          opmlContent: '<opml version="2.0"><body /></opml>',
        },
      });
    });
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "OPML imported",
    });
  });

  it("wraps OPML import failures in the localized account toast", async () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    setupTauriMocks((cmd) => {
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
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "import_opml":
          throw { type: "UserVisible", message: "Invalid OPML" };
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const onImport = await findLatestImportHandler();
    await act(async () => {
      await onImport(new File(["not opml"], "broken.opml", { type: "text/xml" }));
    });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Failed to import OPML: Invalid OPML");
    });
  });

  it("guards OPML import against duplicate in-flight file selections", async () => {
    const importCalls = vi.fn();
    let resolveImport: ((value: unknown) => void) | undefined;

    setupTauriMocks((cmd) => {
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
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "import_opml":
          importCalls();
          return new Promise((resolve) => {
            resolveImport = resolve;
          });
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    const onImport = await findLatestImportHandler();
    const file = new File(['<opml version="2.0"><body /></opml>'], "feeds.opml", { type: "text/xml" });
    let firstImport: Promise<void> | undefined;
    let secondImport: Promise<void> | undefined;
    await act(async () => {
      firstImport = onImport(file);
      secondImport = onImport(file);
    });

    expect(importCalls).toHaveBeenCalledTimes(1);

    resolveImport?.([]);
    if (!firstImport || !secondImport) {
      throw new Error("Expected import promises to be created");
    }
    await act(async () => {
      await Promise.all([firstImport, secondImport]);
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
            warnings: [
              {
                account_id: "acc-1",
                account_name: "FreshRSS",
                message: "Skipped 3 entries.",
              },
            ],
          };
        default:
          return undefined;
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
          return undefined;
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
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));

    expect(useUiStore.getState().settingsLoading).toBe(false);
  });

  it("guards manual sync against duplicate in-flight actions", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let resolveSync: (() => void) | undefined;

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
        case "trigger_sync_account":
          return new Promise((resolve) => {
            resolveSync = () =>
              resolve({
                synced: true,
                total: 1,
                succeeded: 1,
                failed: [],
                warnings: [],
              });
          });
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Sync Now" }));
    expect(await screen.findByRole("button", { name: /Syncing/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Syncing/ }));

    expect(calls.filter((call) => call.cmd === "trigger_sync_account")).toHaveLength(1);

    if (!resolveSync) {
      throw new Error("sync promise was never created");
    }
    resolveSync();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sync Now" })).not.toBeDisabled();
    });
  });

  it("guards setup retry against duplicate in-flight actions and disables edit credentials", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    let resolveSync: (() => void) | undefined;

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
        case "trigger_sync_account":
          return new Promise((resolve) => {
            resolveSync = () =>
              resolve({
                synced: true,
                total: 1,
                succeeded: 1,
                failed: [],
                warnings: [],
              });
          });
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-1",
      selectedAccountId: "acc-1",
      accountSetupSession: {
        accountId: "acc-1",
        owner: "add-account",
        state: "failed",
        errorMessage: "Sync failed: Authentication failed",
      },
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Retry setup" }));
    expect(await screen.findByRole("button", { name: "Setting up…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Edit credentials" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Setting up…" }));

    expect(calls.filter((call) => call.cmd === "trigger_sync_account")).toHaveLength(1);

    if (!resolveSync) {
      throw new Error("sync promise was never created");
    }
    resolveSync();

    await waitFor(() => {
      expect(useUiStore.getState().accountSetupSession).toBeNull();
    });
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
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "FreshRSS" }));
    const input = await screen.findByRole("textbox", { name: "Account name" });
    await user.clear(input);
    await user.type(input, "  Team FreshRSS  ");
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
