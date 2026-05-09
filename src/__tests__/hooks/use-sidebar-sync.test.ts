import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSidebarSyncCompletedPayload,
  resolveSidebarLastSyncedLabel,
  resolveSidebarSyncProgressPayload,
  resolveSidebarSyncWarningPayload,
  useSidebarSync,
} from "@/components/reader/hooks/sidebar/use-sidebar-sync";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import {
  getManualSyncCooldownUntil,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
} from "@/lib/sync/manual-sync";

type EventCallback = (event: unknown) => void;
type Cleanup = () => void;

const listenMock = vi.hoisted(() => vi.fn<(eventName: string, callback: EventCallback) => Promise<Cleanup>>());

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("@/lib/sync/manual-sync", () => ({
  getManualSyncCooldownUntil: vi.fn(() => 0),
  subscribeManualSyncCooldown: vi.fn(() => () => {}),
  triggerManualSyncWithCooldown: vi.fn(),
}));

const labels = {
  todayAt: (time: string) => `today:${time}`,
  dateAt: (date: string, time: string) => `date:${date}:${time}`,
  checkingSyncStatus: "checking",
  syncStatusUnavailable: "status unavailable",
  notSyncedYet: "not synced",
};

const syncProgressPayload = {
  stage: "account_started",
  kind: "manual_all",
  total: 2,
  completed: 1,
  account_id: "acc-1",
  account_name: "Account 1",
  success: null,
} as const;

function getRegisteredListener(eventName: string): EventCallback {
  const call = listenMock.mock.calls.find(([registeredEventName]) => registeredEventName === eventName);
  if (!call) {
    throw new Error(`Missing listener for ${eventName}`);
  }
  return call[1];
}

function createSyncHookParams(
  overrides?: Partial<Parameters<typeof useSidebarSync>[0]>,
): Parameters<typeof useSidebarSync>[0] {
  return {
    selectedAccountId: null,
    syncProgress: {
      active: false,
      kind: null,
      stage: null,
      total: 0,
      completed: 0,
      currentAccountName: null,
      activeAccountIds: new Set(),
    },
    applySyncProgress: vi.fn(),
    clearSyncProgress: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
}

describe("resolveSidebarLastSyncedLabel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    listenMock.mockReset().mockResolvedValue(() => {});
    vi.mocked(getManualSyncCooldownUntil).mockReturnValue(0);
    vi.mocked(subscribeManualSyncCooldown).mockReturnValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not collapse sync status query failures into the never-synced label", () => {
    expect(
      resolveSidebarLastSyncedLabel({
        selectedAccountId: "acc-1",
        lastSuccessAt: undefined,
        isPending: false,
        isError: true,
        language: "en",
        labels,
      }),
    ).toBe("status unavailable");
  });

  it("keeps empty account state on the never-synced label", () => {
    expect(
      resolveSidebarLastSyncedLabel({
        selectedAccountId: null,
        lastSuccessAt: undefined,
        isPending: false,
        isError: false,
        language: "en",
        labels,
      }),
    ).toBe("not synced");
  });

  it("invalidates account sync statuses when manual sync reports an error", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(triggerManualSyncWithCooldown).mockImplementation(async (params) => {
      params.onError({ type: "UserVisible", message: "boom" });
    });

    const { result } = renderHook(
      () =>
        useSidebarSync({
          ...createSyncHookParams(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSync();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accountSyncStatusQueryKey(),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Sync failed:", {
      type: "UserVisible",
      message: "boom",
    });
  });

  it("accepts wrapped and raw sync progress payloads but ignores unknown payloads", () => {
    expect(resolveSidebarSyncProgressPayload({ payload: syncProgressPayload })).toEqual(syncProgressPayload);
    expect(resolveSidebarSyncProgressPayload(syncProgressPayload)).toEqual(syncProgressPayload);
    expect(resolveSidebarSyncProgressPayload({ payload: { ...syncProgressPayload, total: -1 } })).toBeNull();
    expect(resolveSidebarSyncProgressPayload({ payload: "not-progress" })).toBeNull();
  });

  it("accepts missing account ids and out-of-range completed counts for store normalization", () => {
    expect(
      resolveSidebarSyncProgressPayload({
        payload: {
          ...syncProgressPayload,
          completed: 4,
          account_id: undefined,
          account_name: undefined,
        },
      }),
    ).toEqual({
      ...syncProgressPayload,
      completed: 4,
      account_id: undefined,
      account_name: undefined,
    });
  });

  it("accepts wrapped and raw sync warning payloads but ignores unknown payloads", () => {
    const syncWarningPayload = [
      {
        account_id: "acc-1",
        account_name: "Account 1",
        message: "Network timeout",
      },
    ];

    expect(resolveSidebarSyncWarningPayload({ payload: syncWarningPayload })).toEqual(syncWarningPayload);
    expect(resolveSidebarSyncWarningPayload(syncWarningPayload)).toEqual(syncWarningPayload);
    expect(resolveSidebarSyncWarningPayload({ payload: [{ account_id: "acc-1" }] })).toBeNull();
    expect(resolveSidebarSyncWarningPayload({ payload: "not-warnings" })).toBeNull();
  });

  it("accepts null sync completed payloads but rejects malformed payloads", () => {
    expect(isSidebarSyncCompletedPayload({ payload: null })).toBe(true);
    expect(isSidebarSyncCompletedPayload(null)).toBe(true);
    expect(isSidebarSyncCompletedPayload({ payload: undefined })).toBe(false);
    expect(isSidebarSyncCompletedPayload({ payload: {} })).toBe(false);
  });

  it("ignores malformed sync progress events without applying progress", () => {
    const { wrapper } = createQueryWrapper();
    const applySyncProgress = vi.fn();

    renderHook(() => useSidebarSync(createSyncHookParams({ applySyncProgress })), { wrapper });

    act(() => {
      getRegisteredListener("sync-progress")({ payload: { ...syncProgressPayload, completed: Number.NaN } });
      getRegisteredListener("sync-progress")({ payload: syncProgressPayload });
    });

    expect(applySyncProgress).toHaveBeenCalledTimes(1);
    expect(applySyncProgress).toHaveBeenCalledWith(syncProgressPayload);
  });

  it("ignores malformed sync completed events without clearing progress or invalidating", () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const clearSyncProgress = vi.fn();

    renderHook(() => useSidebarSync(createSyncHookParams({ clearSyncProgress })), { wrapper });

    act(() => {
      getRegisteredListener("sync-completed")({ payload: { completed: true } });
      getRegisteredListener("sync-completed")({ payload: null });
    });

    expect(clearSyncProgress).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accountSyncStatusQueryKey(),
    });
  });

  it("logs account sync status invalidation failures after sync completion", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidationError = new Error("sync status cache refresh failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(invalidationError);
    const clearSyncProgress = vi.fn();

    renderHook(() => useSidebarSync(createSyncHookParams({ clearSyncProgress })), { wrapper });

    act(() => {
      getRegisteredListener("sync-completed")({ payload: null });
    });

    expect(clearSyncProgress).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("Query invalidation failed:", {
        queryKey: accountSyncStatusQueryKey(),
        error: invalidationError,
      });
    });
  });

  it("ignores malformed sync warning events without invalidating or showing a toast", () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const showToast = vi.fn();

    renderHook(() => useSidebarSync(createSyncHookParams({ showToast })), { wrapper });

    act(() => {
      getRegisteredListener("sync-warning")({
        payload: [
          {
            account_id: "acc-1",
            account_name: "Account 1",
          },
        ],
      });
    });

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("cleans up the sidebar cooldown interval on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00.000Z"));
    vi.mocked(getManualSyncCooldownUntil).mockReturnValue(Date.now() + 15_000);
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { wrapper } = createQueryWrapper();

    const { unmount } = renderHook(() => useSidebarSync(createSyncHookParams()), { wrapper });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1_000);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(setIntervalSpy.mock.results[0]?.value);
  });

  it("keeps rendering when the sidebar cooldown interval runtime is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00.000Z"));
    vi.mocked(getManualSyncCooldownUntil).mockReturnValue(Date.now() + 15_000);
    const intervalError = new Error("interval unavailable");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "setInterval").mockImplementation(() => {
      throw intervalError;
    });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { wrapper } = createQueryWrapper();

    const { result, unmount } = renderHook(() => useSidebarSync(createSyncHookParams()), { wrapper });

    expect(result.current.isSyncCoolingDown).toBe(true);
    expect(consoleWarn).toHaveBeenCalledWith("Sidebar sync cooldown interval unavailable:", intervalError);

    unmount();

    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });
});
