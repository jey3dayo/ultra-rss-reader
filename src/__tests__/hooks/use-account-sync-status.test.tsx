import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  accountSyncStatusQueryKey,
  useAccountSyncStatus,
} from "@/hooks/use-account-sync-status";

describe("useAccountSyncStatus", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    wrapper = createQueryWrapper().wrapper;
    vi.restoreAllMocks();
  });

  it("uses the shared account sync status query key prefix", () => {
    expect(accountSyncStatusQueryKey()).toEqual(["account-sync-status"]);
    expect(accountSyncStatusQueryKey("acc-1")).toEqual([
      "account-sync-status",
      "acc-1",
    ]);
  });

  it("keeps null and empty account queries disabled and calls the API for an account id", async () => {
    const getAccountSyncStatusSpy = vi
      .spyOn(tauriCommands, "getAccountSyncStatus")
      .mockResolvedValue(
        Result.succeed({
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        }),
      );

    const initialProps: { accountId: string | null } = { accountId: null };
    const { rerender, result } = renderHook(
      ({ accountId }: { accountId: string | null }) =>
        useAccountSyncStatus(accountId),
      {
        initialProps,
        wrapper,
      },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(getAccountSyncStatusSpy).not.toHaveBeenCalled();

    rerender({ accountId: "" });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getAccountSyncStatusSpy).not.toHaveBeenCalled();

    rerender({ accountId: "acc-1" });

    await waitFor(() => {
      expect(getAccountSyncStatusSpy).toHaveBeenCalledWith("acc-1");
    });
  });

  it("surfaces account sync status query failures", async () => {
    vi.spyOn(tauriCommands, "getAccountSyncStatus").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "status unavailable" }),
    );

    const { result } = renderHook(() => useAccountSyncStatus("acc-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
