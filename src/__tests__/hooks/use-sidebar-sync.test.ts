import { act, renderHook } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSidebarLastSyncedLabel } from "@/components/reader/hooks/sidebar/use-sidebar-sync";
import { useSidebarSync } from "@/components/reader/hooks/sidebar/use-sidebar-sync";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import { triggerManualSyncWithCooldown } from "@/lib/sync/manual-sync";

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

describe("resolveSidebarLastSyncedLabel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(triggerManualSyncWithCooldown).mockImplementation(
      async (params) => {
        params.onError({ type: "UserVisible", message: "boom" });
      },
    );

    const { result } = renderHook(
      () =>
        useSidebarSync({
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
});
