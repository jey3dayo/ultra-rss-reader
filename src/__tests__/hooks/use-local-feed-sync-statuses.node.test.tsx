import { Result } from "@praha/byethrow";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncResultDto } from "@/api/schemas";
import type { AccountDto, LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import {
  __resetFeedRetryStateForTests,
  localFeedSyncStatusesQueryKey,
  useLocalFeedSyncStatuses,
} from "@/hooks/use-local-feed-sync-statuses";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const accounts: AccountDto[] = [
  {
    id: "acc-1",
    kind: "Local",
    name: "Local one",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "Local",
    name: "Local two",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-remote",
    kind: "FreshRss",
    name: "Remote",
    server_url: "https://reader.example.com",
    username: "reader",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-legacy-local",
    kind: "local",
    name: "Legacy local",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

const failedStatus: LocalFeedSyncStatusDto = {
  feed_id: "feed-1",
  last_attempt_at: "2026-04-04T12:00:00Z",
  last_success_at: null,
  error_kind: "network",
  error_count: 1,
  diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
};

const failedSync: SyncResultDto = {
  synced: true,
  total: 1,
  succeeded: 0,
  failed: [{ account_id: "acc-1", account_name: "Local one", message: "Fetch failed" }],
  warnings: [],
};

const alreadySyncing: SyncResultDto = {
  synced: false,
  total: 0,
  succeeded: 0,
  failed: [],
  warnings: [],
};

const successfulSync: SyncResultDto = {
  synced: true,
  total: 1,
  succeeded: 1,
  failed: [],
  warnings: [],
};

describe("useLocalFeedSyncStatuses", () => {
  let queryClient: ReturnType<typeof createQueryWrapper>["queryClient"];
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    ({ queryClient, wrapper } = createQueryWrapper());
    __resetFeedRetryStateForTests();
    useUiStore.setState({ selectedAccountId: "acc-1", subscriptionsWorkspace: { kind: "index", accountId: "acc-1" } });
    vi.spyOn(tauriCommands, "listAccounts").mockResolvedValue(Result.succeed(accounts));
  });

  afterEach(async () => {
    cleanup();
    useUiStore.setState({ selectedAccountId: null, subscriptionsWorkspace: null });
    vi.restoreAllMocks();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("loads local statuses by account and does not probe remote accounts", async () => {
    const statusSpy = vi
      .spyOn(tauriCommands, "getLocalFeedSyncStatuses")
      .mockImplementation(async (accountId) => Result.succeed(accountId === "acc-1" ? [failedStatus] : []));
    const { result, rerender } = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });

    await waitFor(() => expect(result.current.statusQuery.data).toEqual([failedStatus]));
    rerender({ accountId: "acc-2" });
    await waitFor(() => expect(result.current.statusQuery.data).toEqual([]));
    rerender({ accountId: "acc-remote" });

    expect(result.current.isLocalAccount).toBe(false);
    expect(statusSpy.mock.calls.map(([accountId]) => accountId)).toEqual(["acc-1", "acc-2"]);
  });

  it("keeps status query failures unavailable instead of returning an empty healthy list", async () => {
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "status unavailable" }),
    );
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isError).toBe(true));
    expect(result.current.statusQuery.data).toBeUndefined();
  });

  it("recognizes a lowercase Local provider kind before querying health", async () => {
    const statusSpy = vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([]));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-legacy-local"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    expect(result.current.isLocalAccount).toBe(true);
    expect(statusSpy).toHaveBeenCalledWith("acc-legacy-local");
  });

  it.each([
    [alreadySyncing, "busy"],
    [failedSync, "incomplete"],
  ] as const)("keeps a distinct retry outcome for the sync result", async (syncResult, expectedOutcome) => {
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([failedStatus]));
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.succeed(syncResult));
    const toastSpy = vi.spyOn(useUiStore.getState(), "showToast");
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));

    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBe(expectedOutcome));
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
    expect(result.current.retryOutcomeFor("feed-1")).toBe(expectedOutcome);
    expect(result.current.retryOutcomeFor("feed-2")).toBeNull();
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("shows a successful retry until the refreshed statuses arrive, then clears it", async () => {
    let statusReads = 0;
    const refreshedStatuses = createDeferred<ReturnType<typeof Result.succeed<LocalFeedSyncStatusDto[]>>>();
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockImplementation(() => {
      statusReads += 1;
      return statusReads === 1 ? Promise.resolve(Result.succeed([failedStatus])) : refreshedStatuses.promise;
    });
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.succeed(successfulSync));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBe("succeeded"));

    await act(async () => {
      refreshedStatuses.resolve(Result.succeed([]));
    });
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
    expect(result.current.retryOutcomeFor("feed-1")).toBeNull();
  });

  it("keeps a failed retry request as the outcome", async () => {
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([failedStatus]));
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.fail({ type: "UserVisible", message: "sync failed" }));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));

    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
    expect(result.current.retryOutcomeFor("feed-1")).toBe("failed");
  });

  it("reports an unrefreshed status after a retry that did run as a refresh failure", async () => {
    let statusReads = 0;
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockImplementation(async () => {
      statusReads += 1;
      return statusReads === 1
        ? Result.succeed([failedStatus])
        : Result.fail({ type: "UserVisible", message: "status refresh failed" });
    });
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.succeed(successfulSync));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));

    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
    expect(result.current.retryOutcomeFor("feed-1")).toBe("refresh-failed");
  });

  it("clears the previous outcome when a new retry starts", async () => {
    const secondSync = createDeferred<Awaited<ReturnType<typeof tauriCommands.syncFeed>>>();
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([failedStatus]));
    const syncFeedSpy = vi
      .spyOn(tauriCommands, "syncFeed")
      .mockResolvedValueOnce(Result.succeed(failedSync))
      .mockReturnValueOnce(secondSync.promise);
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBe("incomplete"));
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));

    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(2));
    expect(result.current.retryOutcomeFor("feed-1")).toBeNull();

    await act(async () => {
      secondSync.resolve(Result.succeed(alreadySyncing));
    });
    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBe("busy"));
  });

  it("drops a retry outcome once a newer fetch attempt supersedes the status it explained", async () => {
    let statusReads = 0;
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockImplementation(async () => {
      statusReads += 1;
      return Result.succeed([
        { ...failedStatus, last_attempt_at: statusReads <= 2 ? "2026-04-04T12:00:00Z" : "2026-04-05T12:00:00Z" },
      ]);
    });
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.succeed(failedSync));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
    expect(result.current.retryOutcomeFor("feed-1")).toBe("incomplete");

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: localFeedSyncStatusesQueryKey("acc-1") });
    });
    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBeNull());
  });

  it("keeps a retry outcome with its own account and survives a remount while the account is not shown", async () => {
    let resolveSync: ((result: Awaited<ReturnType<typeof tauriCommands.syncFeed>>) => void) | undefined;
    const syncFeedSpy = vi.spyOn(tauriCommands, "syncFeed").mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof tauriCommands.syncFeed>>>((resolve) => {
          resolveSync = resolve;
        }),
    );
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([failedStatus]));
    const toastSpy = vi.spyOn(useUiStore.getState(), "showToast");
    const { result, rerender } = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledWith("feed-1"));
    useUiStore.setState({ subscriptionsWorkspace: { kind: "index", accountId: "acc-2" } });
    rerender({ accountId: "acc-2" });
    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));

    await act(async () => {
      resolveSync?.(Result.succeed(failedSync));
    });
    await waitFor(() =>
      expect(queryClient.getQueryState(localFeedSyncStatusesQueryKey("acc-1"))?.isInvalidated).toBe(true),
    );

    expect(queryClient.getQueryState(localFeedSyncStatusesQueryKey("acc-2"))?.isInvalidated).toBe(false);
    expect(result.current.retryOutcomeFor("feed-1")).toBeNull();
    expect(toastSpy).not.toHaveBeenCalled();

    useUiStore.setState({ subscriptionsWorkspace: { kind: "index", accountId: "acc-1" } });
    rerender({ accountId: "acc-1" });
    await waitFor(() => expect(result.current.retryOutcomeFor("feed-1")).toBe("incomplete"));
  });

  it("prevents duplicate requests for one pending account/feed pair", async () => {
    const retryResolvers = new Map<string, (result: Awaited<ReturnType<typeof tauriCommands.syncFeed>>) => void>();
    const syncFeedSpy = vi.spyOn(tauriCommands, "syncFeed").mockImplementation(
      (feedId) =>
        new Promise<Awaited<ReturnType<typeof tauriCommands.syncFeed>>>((resolve) => {
          retryResolvers.set(feedId, resolve);
        }),
    );
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([]));
    const { result } = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => {
      result.current.retryFeed("feed-1");
      result.current.retryFeed("feed-1");
    });
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(1));
    expect(result.current.isRetryingFeed("feed-1")).toBe(true);

    await act(async () => {
      retryResolvers.get("feed-1")?.(Result.succeed(successfulSync));
    });
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
  });

  it("keeps retry dedupe and pending state across a remount while the sync is in flight", async () => {
    const retryResolvers = new Map<string, (result: Awaited<ReturnType<typeof tauriCommands.syncFeed>>) => void>();
    const syncFeedSpy = vi.spyOn(tauriCommands, "syncFeed").mockImplementation(
      (feedId) =>
        new Promise<Awaited<ReturnType<typeof tauriCommands.syncFeed>>>((resolve) => {
          retryResolvers.set(feedId, resolve);
        }),
    );
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([]));
    const first = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });

    await waitFor(() => expect(first.result.current.statusQuery.isSuccess).toBe(true));
    act(() => first.result.current.retryFeed("feed-1"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(1));
    expect(first.result.current.isRetryingFeed("feed-1")).toBe(true);

    first.unmount();

    const second = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });
    await waitFor(() => expect(second.result.current.statusQuery.isSuccess).toBe(true));
    expect(second.result.current.isRetryingFeed("feed-1")).toBe(true);

    act(() => second.result.current.retryFeed("feed-1"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      retryResolvers.get("feed-1")?.(Result.succeed(successfulSync));
    });
    await waitFor(() => expect(second.result.current.isRetryingFeed("feed-1")).toBe(false));
  });

  it("keeps the first account retry pending when an overlapping second-account retry settles", async () => {
    const retryResolvers = new Map<string, (result: Awaited<ReturnType<typeof tauriCommands.syncFeed>>) => void>();
    const syncFeedSpy = vi.spyOn(tauriCommands, "syncFeed").mockImplementation(
      (feedId) =>
        new Promise<Awaited<ReturnType<typeof tauriCommands.syncFeed>>>((resolve) => {
          retryResolvers.set(feedId, resolve);
        }),
    );
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockResolvedValue(Result.succeed([]));
    const { result, rerender } = renderHook(({ accountId }) => useLocalFeedSyncStatuses(accountId), {
      initialProps: { accountId: "acc-1" },
      wrapper,
    });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(1));
    expect(result.current.isRetryingFeed("feed-1")).toBe(true);

    useUiStore.setState({ subscriptionsWorkspace: { kind: "index", accountId: "acc-2" } });
    rerender({ accountId: "acc-2" });
    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-2"));
    await waitFor(() => expect(syncFeedSpy).toHaveBeenCalledTimes(2));
    expect(result.current.isRetryingFeed("feed-2")).toBe(true);

    await act(async () => {
      retryResolvers.get("feed-2")?.(Result.succeed(successfulSync));
    });
    await waitFor(() => expect(result.current.isRetryingFeed("feed-2")).toBe(false));

    useUiStore.setState({ selectedAccountId: "acc-1", subscriptionsWorkspace: { kind: "index", accountId: "acc-1" } });
    rerender({ accountId: "acc-1" });
    expect(result.current.isRetryingFeed("feed-1")).toBe(true);
    await act(async () => {
      retryResolvers.get("feed-1")?.(Result.succeed(successfulSync));
    });
    await waitFor(() => expect(result.current.isRetryingFeed("feed-1")).toBe(false));
  });

  it("clears pending state after sync and status-refresh failures", async () => {
    let statusReads = 0;
    vi.spyOn(tauriCommands, "getLocalFeedSyncStatuses").mockImplementation(async () => {
      statusReads += 1;
      return statusReads === 1
        ? Result.succeed([])
        : Result.fail({ type: "UserVisible", message: "status refresh failed" });
    });
    vi.spyOn(tauriCommands, "syncFeed").mockResolvedValue(Result.fail({ type: "UserVisible", message: "sync failed" }));
    const { result } = renderHook(() => useLocalFeedSyncStatuses("acc-1"), { wrapper });

    await waitFor(() => expect(result.current.statusQuery.isSuccess).toBe(true));
    act(() => result.current.retryFeed("feed-1"));

    await waitFor(() => {
      expect(result.current.statusQuery.isError).toBe(true);
      expect(result.current.isRetryingFeed("feed-1")).toBe(false);
    });
    expect(statusReads).toBe(2);
  });
});
