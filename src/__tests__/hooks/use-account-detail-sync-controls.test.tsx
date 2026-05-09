import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateAccountSyncParams } from "@/components/settings/account-detail/sync.types";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import {
  runAccountSetupSync,
  useAccountDetailSyncControls,
} from "@/components/settings/hooks/account-detail/use-account-detail-sync-controls";
import { useUiStore } from "@/stores/ui-store";

const { syncAccountMock, updateAccountSyncMock } = vi.hoisted(() => ({
  syncAccountMock: vi.fn(),
  updateAccountSyncMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  syncAccount: syncAccountMock,
  updateAccountSync: updateAccountSyncMock,
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
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
    queryClient.setQueryData(["accounts"], [account]);
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

    expect(queryClient.getQueryData<AccountDetailAccount[]>(["accounts"])?.[0]).toEqual(
      expect.objectContaining(expected),
    );
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
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["account-sync-status"] });
  });
});
