import { Result } from "@praha/byethrow";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSyncStatusDto } from "@/api/schemas";
import * as tauriCommands from "@/api/tauri-commands";
import { accountSyncStatusQueryKey, useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccountSyncStatuses } from "@/hooks/use-account-sync-statuses";

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("useAccountSyncStatus", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    wrapper = createQueryWrapper().wrapper;
    vi.restoreAllMocks();
  });

  it("uses the shared account sync status query key prefix", () => {
    expect(accountSyncStatusQueryKey()).toEqual(["account-sync-status"]);
    expect(accountSyncStatusQueryKey("acc-1")).toEqual(["account-sync-status", "acc-1"]);
  });

  it("reads cached statuses through the shared account sync status query key", () => {
    const { queryClient, wrapper: cachedWrapper } = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
      },
    });
    const cachedStatus = {
      last_success_at: "2026-05-09T01:23:45.000Z",
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    };
    const getAccountSyncStatusSpy = vi.spyOn(tauriCommands, "getAccountSyncStatus");

    queryClient.setQueryData(accountSyncStatusQueryKey("acc-1"), cachedStatus);

    const { result } = renderHook(() => useAccountSyncStatuses([{ id: "acc-1" }]), {
      wrapper: cachedWrapper,
    });

    expect(result.current).toEqual({ "acc-1": cachedStatus });
    expect(getAccountSyncStatusSpy).not.toHaveBeenCalled();
  });

  it("dedupes duplicate account ids and skips blank ids when reading multiple sync statuses", async () => {
    const acc1Status: AccountSyncStatusDto = {
      last_success_at: "2026-05-09T01:23:45.000Z",
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    };
    const acc2Status: AccountSyncStatusDto = {
      last_success_at: null,
      last_error: "timeout",
      error_count: 2,
      next_retry_at: "2026-05-09T02:00:00.000Z",
    };
    const statusesByAccountId = new Map<string, AccountSyncStatusDto>([
      ["acc-1", acc1Status],
      ["acc-2", acc2Status],
    ]);
    const getAccountSyncStatusSpy = vi
      .spyOn(tauriCommands, "getAccountSyncStatus")
      .mockImplementation(async (accountId) => Result.succeed(statusesByAccountId.get(accountId) ?? acc1Status));

    const { result } = renderHook(
      () => useAccountSyncStatuses([{ id: " acc-1 " }, { id: " " }, { id: "\t" }, { id: "acc-1" }, { id: "acc-2\n" }]),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current).toEqual({
        "acc-1": acc1Status,
        "acc-2": acc2Status,
      });
    });
    expect(getAccountSyncStatusSpy).toHaveBeenCalledTimes(2);
    expect(getAccountSyncStatusSpy).toHaveBeenCalledWith("acc-1");
    expect(getAccountSyncStatusSpy).toHaveBeenCalledWith("acc-2");
  });

  it("keeps null and empty account queries disabled and calls the API for an account id", async () => {
    const getAccountSyncStatusSpy = vi.spyOn(tauriCommands, "getAccountSyncStatus").mockResolvedValue(
      Result.succeed({
        last_success_at: null,
        last_error: null,
        error_count: 0,
        next_retry_at: null,
      }),
    );

    const initialProps: { accountId: string | null } = { accountId: null };
    const { rerender, result } = renderHook(
      ({ accountId }: { accountId: string | null }) => useAccountSyncStatus(accountId),
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

  it.each([
    ["spaces", "   "],
    ["newline", "\n"],
  ])("keeps whitespace-only account queries disabled for %s", (_label, accountId) => {
    const getAccountSyncStatusSpy = vi.spyOn(tauriCommands, "getAccountSyncStatus");

    const { result } = renderHook(() => useAccountSyncStatus(accountId), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(getAccountSyncStatusSpy).not.toHaveBeenCalled();
  });

  it("trims valid account ids before query key and API call", async () => {
    const { queryClient, wrapper: trimmedWrapper } = createQueryWrapper();
    const getAccountSyncStatusSpy = vi.spyOn(tauriCommands, "getAccountSyncStatus").mockResolvedValue(
      Result.succeed({
        last_success_at: null,
        last_error: null,
        error_count: 0,
        next_retry_at: null,
      }),
    );

    renderHook(() => useAccountSyncStatus(" acc-1\n"), {
      wrapper: trimmedWrapper,
    });

    await waitFor(() => {
      expect(getAccountSyncStatusSpy).toHaveBeenCalledWith("acc-1");
    });
    expect(queryClient.getQueryState(accountSyncStatusQueryKey("acc-1"))).toBeDefined();
    expect(queryClient.getQueryState(accountSyncStatusQueryKey(" acc-1\n"))).toBeUndefined();
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
