import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSidebarAccountStatusLabels } from "@/components/reader/use-sidebar-account-status-labels";
import { formatAccountSyncRetryTime } from "@/lib/account-sync-status-format";
import i18n from "@/lib/i18n";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("useSidebarAccountStatusLabels", () => {
  beforeEach(() => {
    setupTauriMocks();
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
    setupTauriMocks((cmd, args) => {
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

    const { result } = renderHook(() => useSidebarAccountStatusLabels([{ id: "acc-1" }, { id: "acc-2" }]), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toEqual({});
    });
  });
});
