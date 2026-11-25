import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSidebarAccountStatusLabels,
  useSidebarAccountStatusLabels,
} from "@/components/reader/hooks/sidebar/use-sidebar-account-status-labels";
import { useRetryClock } from "@/hooks/use-retry-clock";
import { formatAccountSyncRetryDateTime } from "@/lib/account/account-sync-status-format";
import i18n from "@/lib/i18n";

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

describe("useSidebarAccountStatusLabels", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    setupTauriMocks();
  });

  it("re-evaluates at the next retry deadline and when the window regains focus", () => {
    vi.useFakeTimers();
    try {
      const initial = Date.parse("2026-04-13T03:15:00Z");
      vi.setSystemTime(initial);
      const { result } = renderHook(() => useRetryClock([{ next_retry_at: new Date(initial + 1000).toISOString() }]));
      expect(result.current).toBe(initial);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current).toBe(initial + 1000);
      vi.setSystemTime(initial + 5000);
      act(() => window.dispatchEvent(new Event("focus")));
      expect(result.current).toBe(initial + 5000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-arms a deadline beyond the maximum timer delay", () => {
    vi.useFakeTimers();
    try {
      const initial = Date.parse("2026-04-13T03:15:00Z");
      const maxDelay = 2_147_483_647;
      vi.setSystemTime(initial);
      const { result } = renderHook(() =>
        useRetryClock([{ next_retry_at: new Date(initial + maxDelay + 1000).toISOString() }]),
      );
      act(() => vi.advanceTimersByTime(maxDelay));
      expect(result.current).toBe(initial + maxDelay);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current).toBe(initial + maxDelay + 1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-arms when a timer fires before the deadline", () => {
    vi.useFakeTimers();
    try {
      const initial = Date.parse("2026-04-13T03:15:00Z");
      let now = initial;
      vi.spyOn(Date, "now").mockImplementation(() => now);
      const { result } = renderHook(() => useRetryClock([{ next_retry_at: new Date(initial + 1000).toISOString() }]));
      now = initial + 500;
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current).toBe(initial + 500);
      now = initial + 1000;
      act(() => vi.advanceTimersByTime(500));
      expect(result.current).toBe(initial + 1000);
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });

  it("builds no labels for accounts without loaded statuses", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1", sync_enabled: true }],
        accountSyncStatuses: {},
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({});
  });

  it("omits invalid scheduled retry dates", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1", sync_enabled: true }],
        accountSyncStatuses: {
          "acc-1": { next_retry_at: "not-a-date" },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({});
  });

  it("returns retry labels for accounts with scheduled retries", async () => {
    const retryAt = "2099-04-13T03:15:00Z";

    setupTauriMocks((cmd, args) => {
      if (cmd === "get_account_sync_status" && args.accountId === "acc-2") {
        return {
          last_success_at: null,
          last_error: "Network timeout",
          error_count: 2,
          next_retry_at: retryAt,
        };
      }
      return undefined;
    });

    const { result } = renderHook(
      () =>
        useSidebarAccountStatusLabels([
          { id: "acc-1", sync_enabled: true },
          { id: "acc-2", sync_enabled: true },
        ]),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      const retryTime = formatAccountSyncRetryDateTime(retryAt, i18n.language);
      expect(result.current).toEqual({
        "acc-2": i18n.t("account_retry_scheduled_short", { ns: "sidebar", time: retryTime }),
      });
    });
  });

  it("omits accounts without a scheduled retry", async () => {
    const recorder = createTauriMockCallRecorder((cmd, args) => {
      if (cmd === "get_account_sync_status" && args.accountId === "acc-2") {
        return {
          last_success_at: null,
          last_error: "Network timeout",
          error_count: 2,
          next_retry_at: null,
        };
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    const { result } = renderHook(
      () =>
        useSidebarAccountStatusLabels([
          { id: "acc-1", sync_enabled: true },
          { id: "acc-2", sync_enabled: true },
        ]),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(recorder.calls.filter((call) => call.cmd === "get_account_sync_status")).toHaveLength(2);
      expect(result.current).toEqual({});
    });
  });

  it("does not project credential or hard failures as scheduled retries", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1", sync_enabled: true }],
        accountSyncStatuses: {
          "acc-1": { last_error: "Credential check failed", next_retry_at: null },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({});
  });

  it("omits blank account ids and ignores statuses that have no account projection", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [
          { id: "acc-1", sync_enabled: true },
          { id: "", sync_enabled: true },
          { id: "   ", sync_enabled: true },
        ],
        accountSyncStatuses: {
          "": { next_retry_at: "2099-04-13T03:15:00Z" },
          "   ": { next_retry_at: "2099-04-13T03:15:00Z" },
          "acc-1": { next_retry_at: null },
          "acc-ghost": { next_retry_at: "2099-04-13T03:15:00Z" },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({});
  });

  it("projects scheduled retry labels only once for visible account ids", () => {
    const retryAt = "2099-04-13T03:15:00Z";
    const retryTime = formatAccountSyncRetryDateTime(retryAt, "en");
    const scheduledAt = vi.fn((time: string) => `scheduled:${time}`);

    expect(
      buildSidebarAccountStatusLabels({
        accounts: [
          { id: "acc-1", sync_enabled: true },
          { id: "acc-1", sync_enabled: true },
          { id: "acc-2", sync_enabled: true },
          { id: "", sync_enabled: true },
          { id: "   ", sync_enabled: true },
        ],
        accountSyncStatuses: {
          "": { next_retry_at: retryAt },
          "   ": { next_retry_at: retryAt },
          "acc-1": { next_retry_at: retryAt },
          "acc-2": { next_retry_at: null },
          "acc-ghost": { next_retry_at: retryAt },
        },
        language: "en",
        labels: {
          scheduledAt,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({
      "acc-1": `scheduled:${retryTime}`,
    });
    expect(scheduledAt).toHaveBeenCalledTimes(1);
  });

  it("projects the sync-off label for disabled accounts even when a retry is scheduled", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1", sync_enabled: false }],
        accountSyncStatuses: {
          "acc-1": { next_retry_at: "2099-04-13T03:15:00Z" },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          syncOff: "sync-off",
        },
      }),
    ).toEqual({
      "acc-1": "sync-off",
    });
  });
});
