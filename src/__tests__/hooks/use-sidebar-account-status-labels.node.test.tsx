import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSidebarAccountStatusLabels,
  useSidebarAccountStatusLabels,
} from "@/components/reader/hooks/sidebar/use-sidebar-account-status-labels";
import { formatAccountSyncRetryTime } from "@/lib/account/account-sync-status-format";
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

  it("builds no labels for accounts without loaded statuses", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1" }],
        accountSyncStatuses: {},
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          scheduledSoon: "scheduled soon",
        },
      }),
    ).toEqual({});
  });

  it("falls back to a soon label for invalid scheduled retry dates", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1" }],
        accountSyncStatuses: {
          "acc-1": { next_retry_at: "not-a-date" },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          scheduledSoon: "scheduled soon",
        },
      }),
    ).toEqual({
      "acc-1": "scheduled soon",
    });
  });

  it("returns retry labels for accounts with scheduled retries", async () => {
    const retryAt = "2026-04-13T03:15:00Z";

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

    const { result } = renderHook(() => useSidebarAccountStatusLabels([{ id: "acc-1" }, { id: "acc-2" }]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const retryTime = formatAccountSyncRetryTime(retryAt, i18n.language);
      expect(result.current).toEqual({
        "acc-2": retryTime
          ? i18n.t("account_retry_scheduled_short", { ns: "sidebar", time: retryTime })
          : i18n.t("account_retry_scheduled_short_soon", { ns: "sidebar" }),
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

    const { result } = renderHook(() => useSidebarAccountStatusLabels([{ id: "acc-1" }, { id: "acc-2" }]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(recorder.calls.filter((call) => call.cmd === "get_account_sync_status")).toHaveLength(2);
      expect(result.current).toEqual({});
    });
  });

  it("does not project credential or hard failures as scheduled retries", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1" }],
        accountSyncStatuses: {
          "acc-1": { last_error: "Credential check failed", next_retry_at: null },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          scheduledSoon: "scheduled soon",
        },
      }),
    ).toEqual({});
  });

  it("omits blank account ids and ignores statuses that have no account projection", () => {
    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1" }, { id: "" }, { id: "   " }],
        accountSyncStatuses: {
          "": { next_retry_at: "2026-04-13T03:15:00Z" },
          "   ": { next_retry_at: "2026-04-13T03:15:00Z" },
          "acc-1": { next_retry_at: null },
          "acc-ghost": { next_retry_at: "2026-04-13T03:15:00Z" },
        },
        language: "en",
        labels: {
          scheduledAt: (time) => `scheduled:${time}`,
          scheduledSoon: "scheduled soon",
        },
      }),
    ).toEqual({});
  });

  it("projects scheduled retry labels only once for visible account ids", () => {
    const retryAt = "2026-04-13T03:15:00Z";
    const retryTime = formatAccountSyncRetryTime(retryAt, "en");
    const scheduledAt = vi.fn((time: string) => `scheduled:${time}`);

    expect(
      buildSidebarAccountStatusLabels({
        accounts: [{ id: "acc-1" }, { id: "acc-1" }, { id: "acc-2" }, { id: "" }, { id: "   " }],
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
          scheduledSoon: "scheduled soon",
        },
      }),
    ).toEqual({
      "acc-1": `scheduled:${retryTime}`,
    });
    expect(scheduledAt).toHaveBeenCalledTimes(1);
  });
});
