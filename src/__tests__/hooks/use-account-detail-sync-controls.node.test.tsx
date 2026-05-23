import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import {
  runAccountSetupSync,
  type UpdateAccountSyncParams,
  useAccountDetailSyncControls,
} from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import { queryKeys } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

const { syncAccountMock, updateAccountSyncMock } = vi.hoisted(() => ({
  syncAccountMock: vi.fn(),
  updateAccountSyncMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  syncAccount: syncAccountMock,
  updateAccountSync: updateAccountSyncMock,
}));

setupBrowserTestDom();

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

const successfulSyncResult = {
  synced: true,
  total: 1,
  succeeded: 1,
  failed: [],
  warnings: [],
};

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
    syncAccountMock.mockReset();
    updateAccountSyncMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
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
    expect(syncAccountMock).toHaveBeenCalledWith(account.id);
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
});
