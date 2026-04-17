import { renderHook } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { useAccountDetailSyncStatusRows } from "@/components/settings/use-account-detail-sync-status-rows";
import { formatAccountSyncRetryDateTime } from "@/lib/account-sync-status-format";

describe("useAccountDetailSyncStatusRows", () => {
  const t = ((key: string, options?: { count?: number }) => {
    if (key === "account.consecutive_sync_failures_value") {
      return `Failures: ${options?.count ?? 0}`;
    }

    return key;
  }) as unknown as TFunction<"settings">;

  it("returns an empty list when sync status is unavailable", () => {
    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus: undefined,
        language: "en",
        t,
      }),
    );

    expect(result.current).toEqual([]);
  });

  it("builds retry, failure count, and last error rows in order", () => {
    const syncStatus: AccountSyncStatusDto = {
      last_success_at: null,
      next_retry_at: "2026-04-13T10:00:00Z",
      error_count: 3,
      last_error: "Connection failed",
    };
    const expectedRetryAt =
      formatAccountSyncRetryDateTime(syncStatus.next_retry_at ?? undefined, "en") ?? syncStatus.next_retry_at;

    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus,
        language: "en",
        t,
      }),
    );

    expect(result.current).toEqual([
      {
        label: "account.next_automatic_retry",
        value: expectedRetryAt,
      },
      {
        label: "account.consecutive_sync_failures",
        value: "Failures: 3",
      },
      {
        label: "account.last_sync_error",
        value: "Connection failed",
      },
    ]);
  });
});
