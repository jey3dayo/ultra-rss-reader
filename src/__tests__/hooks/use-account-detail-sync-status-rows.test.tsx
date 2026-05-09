import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { useAccountDetailSyncStatusRows } from "@/components/settings/hooks/account-detail/use-account-detail-sync-status-rows";

describe("useAccountDetailSyncStatusRows", () => {
  const createSyncStatus = (overrides: Partial<AccountSyncStatusDto>): AccountSyncStatusDto => ({
    last_success_at: null,
    next_retry_at: null,
    error_count: 0,
    last_error: null,
    ...overrides,
  });

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
      return `${options?.count ?? 0} failures`;
    }

    return `label:${key}`;
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

  it("adds the retry row with locale-formatted date-time text", () => {
    const syncStatus = createSyncStatus({
      next_retry_at: "2026-04-13T10:00:00Z",
    });
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
        label: "label:account.next_automatic_retry",
        value: expectedRetryAt,
      },
    ]);
  });

  it("uses the raw retry date when date-time formatting returns null", () => {
    const syncStatus = createSyncStatus({
      next_retry_at: "not-a-date",
    });

    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus,
        language: "en",
        t,
      }),
    );

    expect(result.current).toEqual([
      {
        label: "label:account.next_automatic_retry",
        value: "not-a-date",
      },
    ]);
  });

  it("adds the consecutive failures row with the translated count", () => {
    const syncStatus = createSyncStatus({
      error_count: 3,
    });

    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus,
        language: "en",
        t,
      }),
    );

    expect(result.current).toEqual([
      {
        label: "label:account.consecutive_sync_failures",
        value: "3 failures",
      },
    ]);
  });

  it("adds the last error row with the backend error text", () => {
    const syncStatus = createSyncStatus({
      last_error: "Connection failed",
    });

    const { result } = renderHook(() =>
      useAccountDetailSyncStatusRows({
        syncStatus,
        language: "en",
        t,
      }),
    );

    expect(result.current).toEqual([
      {
        label: "label:account.last_sync_error",
        value: "Connection failed",
      },
    ]);
  });

  it("orders retry, consecutive failures, and last error rows", () => {
    const syncStatus = createSyncStatus({
      next_retry_at: "2026-04-13T10:00:00Z",
      error_count: 3,
      last_error: "Connection failed",
    });
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
        label: "label:account.next_automatic_retry",
        value: expectedRetryAt,
      },
      {
        label: "label:account.consecutive_sync_failures",
        value: "3 failures",
      },
      {
        label: "label:account.last_sync_error",
        value: "Connection failed",
      },
    ]);
  });
});
