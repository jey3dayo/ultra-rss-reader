import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { useAccountDetailSyncStatusRows } from "@/components/settings/hooks/account-detail/use-account-detail-sync-status-rows";

describe("useAccountDetailSyncStatusRows", () => {
  const formatExpectedRetryDateTime = (retryAt: string | null, language: string): string => {
    if (retryAt === null) {
      throw new Error("retryAt must be present for this test case");
    }

    return new Date(retryAt).toLocaleString(language, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const t = (key: string, options?: { count?: number }) => {
    if (key === "account.consecutive_sync_failures_value") {
      return `Failures: ${options?.count ?? 0}`;
    }

    return key;
  };

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
    const expectedRetryAt = formatExpectedRetryDateTime(syncStatus.next_retry_at, "en");

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

  it("formats the retry date with the requested locale", () => {
    const syncStatus: AccountSyncStatusDto = {
      last_success_at: null,
      next_retry_at: "2026-04-13T10:00:00Z",
      error_count: 0,
      last_error: null,
    };
    const expectedRetryAt = formatExpectedRetryDateTime(syncStatus.next_retry_at, "ja");

    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus,
        language: "ja",
        t,
      }),
    );

    expect(result.current).toEqual([
      {
        label: "account.next_automatic_retry",
        value: expectedRetryAt,
      },
    ]);
  });

  it("falls back to the raw retry date when formatting fails", () => {
    const syncStatus: AccountSyncStatusDto = {
      last_success_at: null,
      next_retry_at: "not-a-date",
      error_count: 0,
      last_error: null,
    };

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
        value: "not-a-date",
      },
    ]);
  });
});
