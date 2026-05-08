import { describe, expect, it } from "vitest";
import { resolveSidebarLastSyncedLabel } from "@/components/reader/hooks/sidebar/use-sidebar-sync";

const labels = {
  todayAt: (time: string) => `today:${time}`,
  dateAt: (date: string, time: string) => `date:${date}:${time}`,
  checkingSyncStatus: "checking",
  syncStatusUnavailable: "status unavailable",
  notSyncedYet: "not synced",
};

describe("resolveSidebarLastSyncedLabel", () => {
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
});
