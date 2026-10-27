import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import {
  runAccountSetupSync,
  type UpdateAccountSyncParams,
  useAccountDetailSyncControls,
} from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import { createFetchErrorsToastAction } from "@/lib/actions";
import { queryClient as appQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { createSettingsDirtyStateRegistry } from "@/lib/settings/settings-dirty-state-registry";
import { useUiStore } from "@/stores/ui-store";

const { listAccountsMock, syncAccountMock, updateAccountSyncMock } = vi.hoisted(() => ({
  listAccountsMock: vi.fn(),
  syncAccountMock: vi.fn(),
  updateAccountSyncMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  listAccounts: listAccountsMock,
  syncAccount: syncAccountMock,
  updateAccountSync: updateAccountSyncMock,
}));

setupBrowserTestDom();

const successfulSyncResult = {
  synced: true,
  total: 1,
  succeeded: 1,
  failed: [],
  warnings: [],
};

const settingsDirtyStateRegistry = createSettingsDirtyStateRegistry();

function clearSettingsDirtyState(): void {
  for (const owner of ["account", "tag", "shortcut", "preferences", "data"] as const) {
    settingsDirtyStateRegistry.deleteEntry(owner);
  }
}

function makeLocalAccount(id: string): AccountDto {
  return { ...sampleAccounts[0], id, kind: "Local" };
}

async function waitForAccountLookup(): Promise<void> {
  await vi.waitFor(() => expect(appQueryClient.getQueryState(queryKeys.accounts.root)?.fetchStatus).toBe("fetching"));
}

async function finishPendingAccountLookup(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeUpdatedAccount(account: AccountDetailAccount, partial: UpdateAccountSyncParams): AccountDetailAccount {
  return {
    ...account,
    sync_interval_secs: partial.syncIntervalSecs ?? account.sync_interval_secs,
    sync_on_startup: partial.syncOnStartup ?? account.sync_on_startup,
    sync_on_wake: partial.syncOnWake ?? account.sync_on_wake,
    keep_read_items_days: partial.keepReadItemsDays ?? account.keep_read_items_days,
  };
}

describe("useAccountDetailSyncControls", () => {
  const t = i18n.getFixedT("en", "settings");

  beforeEach(() => {
    listAccountsMock.mockReset();
    syncAccountMock.mockReset();
    updateAccountSyncMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
    clearSettingsDirtyState();
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    clearSettingsDirtyState();
    appQueryClient.clear();
  });

  it.each<{
    label: string;
    first: UpdateAccountSyncParams;
    second: UpdateAccountSyncParams;
    expected: Partial<AccountDetailAccount>;
  }>([
    {
      label: "sync interval",
      first: { syncIntervalSecs: 900 },
      second: { syncIntervalSecs: 7200 },
      expected: { sync_interval_secs: 7200 },
    },
    {
      label: "startup sync",
      first: { syncOnStartup: false },
      second: { syncOnStartup: true },
      expected: { sync_on_startup: true },
    },
    {
      label: "wake sync",
      first: { syncOnWake: true },
      second: { syncOnWake: false },
      expected: { sync_on_wake: false },
    },
    {
      label: "retention",
      first: { keepReadItemsDays: 7 },
      second: { keepReadItemsDays: 90 },
      expected: { keep_read_items_days: 90 },
    },
  ])("keeps the latest $label update when an older response resolves last", async ({ first, second, expected }) => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    const firstResult = createDeferred<ReturnType<typeof Result.succeed<AccountDetailAccount>>>();
    const secondResult = createDeferred<ReturnType<typeof Result.succeed<AccountDetailAccount>>>();
    updateAccountSyncMock.mockReturnValueOnce(firstResult.promise).mockReturnValueOnce(secondResult.promise);

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account,
        queryClient,
        t,
      }),
    );

    let firstUpdate: Promise<void> | undefined;
    let secondUpdate: Promise<void> | undefined;
    act(() => {
      firstUpdate = result.current.handleSyncUpdate(first);
      secondUpdate = result.current.handleSyncUpdate(second);
    });

    secondResult.resolve(Result.succeed(makeUpdatedAccount(account, second)));
    await secondUpdate;
    firstResult.resolve(Result.succeed(makeUpdatedAccount(account, first)));
    await firstUpdate;

    expect(queryClient.getQueryData<AccountDetailAccount[]>(queryKeys.accounts.root)?.[0]).toEqual(
      expect.objectContaining(expected),
    );
  });

  it("does not show a stale error toast when an older update fails after a newer update succeeds", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    const firstResult = createDeferred<ReturnType<typeof Result.fail<Error>>>();
    const secondResult = createDeferred<ReturnType<typeof Result.succeed<AccountDetailAccount>>>();
    updateAccountSyncMock.mockReturnValueOnce(firstResult.promise).mockReturnValueOnce(secondResult.promise);

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account,
        queryClient,
        t,
      }),
    );

    let firstUpdate: Promise<void> | undefined;
    let secondUpdate: Promise<void> | undefined;
    act(() => {
      firstUpdate = result.current.handleSyncUpdate({ syncIntervalSecs: 900 });
      secondUpdate = result.current.handleSyncUpdate({
        syncIntervalSecs: 7200,
      });
    });

    secondResult.resolve(Result.succeed(makeUpdatedAccount(account, { syncIntervalSecs: 7200 })));
    await secondUpdate;
    firstResult.resolve(Result.fail(new Error("older request failed")));
    await firstUpdate;

    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(queryClient.getQueryData<AccountDetailAccount[]>(queryKeys.accounts.root)?.[0]).toEqual(
      expect.objectContaining({ sync_interval_secs: 7200 }),
    );
  });

  it("ignores a late manual sync result after switching selected accounts", async () => {
    const firstAccount = {
      ...sampleAccounts[1],
      id: "acc-1",
      name: "FreshRSS Work",
    };
    const secondAccount = {
      ...sampleAccounts[1],
      id: "acc-2",
      name: "FreshRSS Personal",
    };
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onSyncStatusChanged = vi.fn();
    const staleSync = createDeferred<ReturnType<typeof Result.fail<Error>>>();
    syncAccountMock.mockReturnValue(staleSync.promise);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailSyncControls({
          account,
          queryClient,
          t,
          onSyncStatusChanged,
        }),
      { initialProps: { account: firstAccount } },
    );

    let syncNow: Promise<void> = Promise.resolve();
    await act(async () => {
      syncNow = result.current.handleSyncNow();
      await Promise.resolve();
    });
    expect(result.current.syncActionInFlight).toBe(true);
    expect(syncAccountMock).toHaveBeenCalledWith(firstAccount.id);

    rerender({ account: secondAccount });

    await act(async () => {
      staleSync.resolve(Result.fail(new Error("stale sync failure")));
      await syncNow;
    });

    expect(result.current.syncActionInFlight).toBe(false);
    expect(onSyncStatusChanged).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("shows only the current manual sync success and clears it when the next run starts", async () => {
    const account = sampleAccounts[1];
    const otherAccount = { ...account, id: "another-account" };
    const queryClient = createTestQueryClient();
    const warningSync = {
      ...successfulSyncResult,
      warnings: [
        { account_id: account.id, account_name: account.name, kind: "generic" as const, message: "Feed warning" },
      ],
    };
    const warningResult = createDeferred<ReturnType<typeof Result.succeed<typeof warningSync>>>();
    syncAccountMock
      .mockResolvedValueOnce(Result.succeed(successfulSyncResult))
      .mockReturnValueOnce(warningResult.promise)
      .mockResolvedValueOnce(Result.succeed(successfulSyncResult));

    const { result, rerender } = renderHook(
      ({ selectedAccount }) =>
        useAccountDetailSyncControls({
          account: selectedAccount,
          queryClient,
          t,
        }),
      { initialProps: { selectedAccount: account } },
    );

    await act(async () => {
      await result.current.handleSyncNow();
    });
    expect(result.current.syncNowSucceeded).toBe(true);

    let secondRun: Promise<void> = Promise.resolve();
    await act(async () => {
      secondRun = result.current.handleSyncNow();
      await Promise.resolve();
    });
    expect(result.current.syncNowSucceeded).toBe(false);
    expect(result.current.syncActionInFlight).toBe(true);

    await act(async () => {
      warningResult.resolve(Result.succeed(warningSync));
      await secondRun;
    });
    expect(result.current.syncNowSucceeded).toBe(false);

    await act(async () => {
      await result.current.handleSyncNow();
    });
    expect(result.current.syncNowSucceeded).toBe(true);

    rerender({ selectedAccount: otherAccount });
    expect(result.current.syncNowSucceeded).toBe(false);
    rerender({ selectedAccount: account });
    expect(result.current.syncNowSucceeded).toBe(false);
  });

  it.each([
    {
      label: "an already-running result",
      result: Result.succeed({ synced: false, total: 0, succeeded: 0, failed: [], warnings: [] }),
    },
    {
      label: "a partial failure",
      result: Result.succeed({
        ...successfulSyncResult,
        failed: [{ account_id: "other-account", account_name: "Other", message: "Unavailable" }],
      }),
    },
    {
      label: "a pending retry",
      result: Result.succeed({
        ...successfulSyncResult,
        warnings: [
          {
            account_id: "other-account",
            account_name: "Other",
            kind: "retry_pending" as const,
            message: "Retry later",
          },
        ],
      }),
    },
    {
      label: "a scheduled retry",
      result: Result.succeed({
        ...successfulSyncResult,
        warnings: [
          {
            account_id: "other-account",
            account_name: "Other",
            kind: "retry_scheduled" as const,
            message: "Retry later",
          },
        ],
      }),
    },
    {
      label: "an operation failure",
      result: Result.fail(new Error("sync unavailable")),
    },
  ])("does not show success for $label", async ({ result: syncResult }) => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    syncAccountMock.mockResolvedValue(syncResult);

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account,
        queryClient,
        t,
      }),
    );

    await act(async () => {
      await result.current.handleSyncNow();
    });

    expect(result.current.syncNowSucceeded).toBe(false);
  });

  it("shows the local feed count and opens fetch errors while preserving in-progress review decisions", async () => {
    const account = { ...sampleAccounts[0], id: "local-account", kind: "Local" };
    const queryClient = createTestQueryClient();
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({
      selectedAccountId: account.id,
      selection: { type: "feed", feedId: "reader-feed" },
      selectedArticleId: "reader-article",
      subscriptionsWorkspace: {
        kind: "index",
        returnState: {
          accountId: account.id,
          activeSummaryFilter: "review",
          selectedFeedId: "kept-feed",
          expandedGroups: { "group:news": false },
          listScrollTop: { scrollTop: 320, layoutGeneration: "reviews", viewportHeight: 600 },
          keptFeedIds: ["kept-feed"],
          deferredFeedIds: ["deferred-feed"],
        },
      },
    });
    syncAccountMock.mockResolvedValue(
      Result.succeed({
        synced: true,
        total: 1,
        succeeded: 1,
        failed: [],
        warnings: [
          {
            account_id: account.id,
            account_name: account.name,
            message: "large backend diagnostic",
            detail: {
              type: "local_feed_sync_failed",
              feed_title: "News",
              message: "large backend diagnostic",
            },
          },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account,
        queryClient,
        t,
      }),
    );

    await act(async () => {
      await result.current.handleSyncNow();
    });

    const toast = useUiStore.getState().toastMessage;
    expect(toast).toMatchObject({
      message: "Sync completed. Some feeds could not be updated (1).",
      actions: [{ label: "View details" }],
    });
    listAccountsMock.mockResolvedValue(Result.succeed([account]));

    await act(async () => {
      toast?.actions?.[0]?.onClick();
      await vi.waitFor(() =>
        expect(useUiStore.getState().subscriptionsWorkspace?.navigationRequest).toEqual({
          accountId: account.id,
          summaryFilter: "fetch_errors",
        }),
      );
    });

    expect(useUiStore.getState().selectedArticleId).toBe("reader-article");
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "reader-feed" });
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      returnState: {
        accountId: account.id,
        activeSummaryFilter: "review",
        selectedFeedId: "kept-feed",
        expandedGroups: { "group:news": false },
        listScrollTop: { scrollTop: 320, layoutGeneration: "reviews", viewportHeight: 600 },
        keptFeedIds: ["kept-feed"],
        deferredFeedIds: ["deferred-feed"],
      },
      navigationRequest: {
        accountId: account.id,
        summaryFilter: "fetch_errors",
      },
    });
  });

  it("does not navigate when the cached Local account was deleted before the toast action is clicked", async () => {
    const deletedAccount = { ...sampleAccounts[0], id: "deleted-local-account", kind: "Local" };
    appQueryClient.setQueryData(queryKeys.accounts.root, [deletedAccount]);
    useUiStore.getState().selectAccount("other-account");
    const action = createFetchErrorsToastAction(deletedAccount.id, "View details");
    expect(action).not.toBeNull();
    const remainingRemoteAccount = { ...sampleAccounts[1], kind: "FreshRss" };
    listAccountsMock.mockResolvedValue(Result.succeed([remainingRemoteAccount]));

    await act(async () => {
      action?.onClick();
      await vi.waitFor(() =>
        expect(appQueryClient.getQueryData(queryKeys.accounts.root)).toEqual([remainingRemoteAccount]),
      );
    });

    expect(useUiStore.getState().selectedAccountId).toBe("other-account");
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("uses the latest toast action when account lookups overlap", async () => {
    const firstAccount = makeLocalAccount("local-first");
    const latestAccount = makeLocalAccount("local-latest");
    appQueryClient.setQueryData(queryKeys.accounts.root, [firstAccount, latestAccount]);
    const pendingAccounts = createDeferred<ReturnType<typeof Result.succeed<AccountDto[]>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const firstAction = createFetchErrorsToastAction(firstAccount.id, "View first details");
    const latestAction = createFetchErrorsToastAction(latestAccount.id, "View latest details");

    act(() => {
      firstAction?.onClick();
      latestAction?.onClick();
    });
    await waitForAccountLookup();

    await act(async () => {
      pendingAccounts.resolve(Result.succeed([firstAccount, latestAccount]));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().selectedAccountId).toBe(latestAccount.id);
    expect(useUiStore.getState().subscriptionsWorkspace).toMatchObject({
      navigationRequest: { accountId: latestAccount.id, summaryFilter: "fetch_errors" },
    });
  });

  it.each<{
    label: string;
    updateScreen: () => void;
  }>([
    {
      label: "account selection",
      updateScreen: () => useUiStore.setState({ selectedAccountId: "newer-account" }),
    },
    {
      label: "settings",
      updateScreen: () => useUiStore.setState({ settingsOpen: true }),
    },
    {
      label: "reader selection",
      updateScreen: () => useUiStore.setState({ selectedArticleId: "newer-article" }),
    },
    {
      label: "subscriptions workspace",
      updateScreen: () => useUiStore.setState({ subscriptionsWorkspace: { kind: "index" } }),
    },
    {
      label: "reader selection that returns to its original value",
      updateScreen: () => {
        useUiStore.setState({ selectedArticleId: "newer-article" });
        useUiStore.setState({ selectedArticleId: "article-before-lookup" });
      },
    },
  ])("preserves a newer $label while the account lookup is pending", async ({ updateScreen }) => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({ selectedAccountId: "current-account", selectedArticleId: "article-before-lookup" });
    const pendingAccounts = createDeferred<ReturnType<typeof Result.succeed<AccountDto[]>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await waitForAccountLookup();
    updateScreen();
    const workspaceAfterUserChange = useUiStore.getState().subscriptionsWorkspace;

    await act(async () => {
      pendingAccounts.resolve(Result.succeed([account]));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().subscriptionsWorkspace).toBe(workspaceAfterUserChange);
    expect(useUiStore.getState().selectedAccountId).not.toBe(account.id);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not show a stale lookup failure after settings change during the request", async () => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    const pendingAccounts = createDeferred<ReturnType<typeof Result.fail<Error>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await waitForAccountLookup();
    useUiStore.setState({ settingsOpen: true, settingsCategory: "accounts" });

    await act(async () => {
      pendingAccounts.resolve(Result.fail(new Error("lookup failed")));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it.each([
    { label: "dirty", dirty: true, pending: false },
    { label: "pending", dirty: false, pending: true },
  ])("keeps settings open when a $label settings change would be abandoned", async ({ dirty, pending }) => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({ selectedAccountId: "current-account", settingsOpen: true });
    settingsDirtyStateRegistry.setEntry({ owner: "account", dirty, pending, blockingReason: null });
    const pendingAccounts = createDeferred<ReturnType<typeof Result.succeed<AccountDto[]>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await waitForAccountLookup();
    await act(async () => {
      pendingAccounts.resolve(Result.succeed([account]));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().selectedAccountId).toBe("current-account");
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("keeps settings open when the settings dirty state appears during account lookup", async () => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({ selectedAccountId: "current-account", settingsOpen: true });
    const pendingAccounts = createDeferred<ReturnType<typeof Result.succeed<AccountDto[]>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await waitForAccountLookup();
    settingsDirtyStateRegistry.setEntry({ owner: "account", dirty: false, pending: true, blockingReason: null });
    await act(async () => {
      pendingAccounts.resolve(Result.succeed([account]));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().selectedAccountId).toBe("current-account");
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("does not navigate when closeSettings is blocked by account setup", async () => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({
      selectedAccountId: "current-account",
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: account.id,
      accountSetupSession: { accountId: account.id, owner: "account-detail", state: "syncing" },
    });
    listAccountsMock.mockResolvedValue(Result.succeed([account]));
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await vi.waitFor(() => expect(appQueryClient.getQueryState(queryKeys.accounts.root)?.status).toBe("success"));
    await finishPendingAccountLookup();

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().selectedAccountId).toBe("current-account");
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("allows toast and sync progress updates while the account lookup is pending", async () => {
    const account = makeLocalAccount("local-account");
    appQueryClient.setQueryData(queryKeys.accounts.root, [account]);
    useUiStore.setState({ selection: { type: "feed", feedId: "same-feed" } });
    const pendingAccounts = createDeferred<ReturnType<typeof Result.succeed<AccountDto[]>>>();
    listAccountsMock.mockReturnValue(pendingAccounts.promise);
    const action = createFetchErrorsToastAction(account.id, "View details");

    act(() => action?.onClick());
    await waitForAccountLookup();
    useUiStore.getState().showToast({ message: "Sync is still running", progress: 0.5 });
    useUiStore.setState((state) => ({ syncProgress: { ...state.syncProgress, total: 1 } }));
    useUiStore.setState({ selection: { type: "feed", feedId: "same-feed" } });
    await act(async () => {
      pendingAccounts.resolve(Result.succeed([account]));
      await finishPendingAccountLookup();
    });

    expect(useUiStore.getState().subscriptionsWorkspace).toMatchObject({
      navigationRequest: { accountId: account.id, summaryFilter: "fetch_errors" },
    });
    expect(useUiStore.getState().toastMessage).toMatchObject({ message: "Sync is still running", progress: 0.5 });
    expect(useUiStore.getState().syncProgress.total).toBe(1);
  });

  it("clears stale account status and feed caches before retrying setup", async () => {
    const account = { ...sampleAccounts[1], id: "acc-setup" };
    const queryClient = createTestQueryClient();
    const staleStatus = {
      account_id: account.id,
      last_success_at: null,
      last_error: "stale error",
    };
    queryClient.setQueryData(["account-sync-status", account.id], staleStatus);
    queryClient.setQueryData(queryKeys.feeds.byAccount(account.id), [{ id: "feed-1", title: "Stale feed" }]);
    syncAccountMock.mockResolvedValue(Result.fail(new Error("still failing")));

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account,
        queryClient,
        t,
        accountSetupState: "failed",
      }),
    );

    await act(async () => {
      await result.current.handleSetupRetry();
    });

    expect(queryClient.getQueryData(["account-sync-status", account.id])).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.feeds.byAccount(account.id))).toBeUndefined();
    expect(syncAccountMock).toHaveBeenCalledWith(account.id, "interactive");
  });

  it("recovers account setup sync when the native sync promise rejects", async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onSyncStatusChanged = vi.fn();
    syncAccountMock.mockRejectedValue(new Error("transport down"));

    await runAccountSetupSync({
      accountId: "acc-setup",
      queryClient,
      t,
      onSyncStatusChanged,
      owner: "account-detail",
    });

    expect(useUiStore.getState().accountSetupSession).toEqual({
      accountId: "acc-setup",
      owner: "account-detail",
      state: "failed",
      errorMessage: "Sync failed: transport down",
    });
    expect(onSyncStatusChanged).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["account-sync-status"],
    });
  });

  it("keeps stale account setup finalization scoped to the session that started it", async () => {
    const queryClient = createTestQueryClient();
    const staleSetup = createDeferred<ReturnType<typeof Result.fail<Error>>>();
    const currentSetup = createDeferred<ReturnType<typeof Result.succeed<typeof successfulSyncResult>>>();
    syncAccountMock.mockReturnValueOnce(staleSetup.promise).mockReturnValueOnce(currentSetup.promise);

    const firstSetup = runAccountSetupSync({
      accountId: "acc-setup",
      queryClient,
      t,
      owner: "account-detail",
    });
    const secondSetup = runAccountSetupSync({
      accountId: "acc-setup",
      queryClient,
      t,
      owner: "account-detail",
    });

    currentSetup.resolve(Result.succeed(successfulSyncResult));
    await secondSetup;
    staleSetup.resolve(Result.fail(new Error("stale setup failed")));
    await firstSetup;

    expect(useUiStore.getState().selectedAccountId).toBe("acc-setup");
    expect(useUiStore.getState().accountSetupSession).toBeNull();
    expect(useUiStore.getState().toastMessage?.message).toBe(t("account.setup_complete"));
  });

  it("handles terminal events from older sessions when sessions interleave", async () => {
    const queryClient = createTestQueryClient();
    const firstAccount = makeLocalAccount("acc-1");
    listAccountsMock.mockResolvedValue(Result.succeed([firstAccount]));

    const manualSyncDeferred = createDeferred<ReturnType<typeof Result.succeed<typeof successfulSyncResult>>>();
    syncAccountMock.mockReturnValueOnce(manualSyncDeferred.promise);

    const { result } = renderHook(() =>
      useAccountDetailSyncControls({
        account: firstAccount,
        queryClient,
        t,
      }),
    );

    useUiStore.getState().applySyncProgress({
      session_id: 1,
      kind: "manual_account",
      stage: "started",
      total: 1,
      completed: 0,
    });
    useUiStore.getState().applySyncProgress({
      session_id: 1,
      kind: "manual_account",
      stage: "account_started",
      total: 1,
      completed: 0,
      account_id: firstAccount.id,
      account_name: firstAccount.name,
    });

    expect(useUiStore.getState().syncProgress.active).toBe(true);
    expect(useUiStore.getState().syncProgress.sessionId).toBe(1);
    expect(useUiStore.getState().syncProgress.activeAccountIds.has(firstAccount.id)).toBe(true);

    useUiStore.getState().applySyncProgress({
      session_id: 2,
      kind: "automatic",
      stage: "started",
      total: 1,
      completed: 0,
    });

    expect(useUiStore.getState().syncProgress.sessionId).toBe(2);
    expect(useUiStore.getState().syncProgress.activeAccountIds.has(firstAccount.id)).toBe(false);

    useUiStore.getState().applySyncProgress({
      session_id: 2,
      kind: "automatic",
      stage: "finished",
      total: 1,
      completed: 1,
      success: true,
    });

    expect(useUiStore.getState().syncProgress.active).toBe(false);

    useUiStore.getState().applySyncProgress({
      session_id: 1,
      kind: "manual_account",
      stage: "account_finished",
      total: 1,
      completed: 1,
      account_id: firstAccount.id,
      account_name: firstAccount.name,
      success: true,
    });
    useUiStore.getState().applySyncProgress({
      session_id: 1,
      kind: "manual_account",
      stage: "finished",
      total: 1,
      completed: 1,
      success: true,
    });

    expect(useUiStore.getState().syncProgress.active).toBe(false);

    const syncPromise = act(async () => {
      await result.current.handleSyncNow();
    });

    manualSyncDeferred.resolve(Result.succeed(successfulSyncResult));
    await syncPromise;
  });
});
