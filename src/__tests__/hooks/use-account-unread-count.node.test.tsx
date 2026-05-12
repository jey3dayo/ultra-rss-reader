import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";
import { queryKeys } from "@/lib/query/query-invalidation";

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe("useAccountUnreadCount", () => {
  beforeEach(() => {
    teardownTauriMocks();
    setupTauriMocks();
  });

  it("keeps whitespace-only account ids disabled", () => {
    const recorder = createTauriMockCallRecorder();
    setupTauriMocks(recorder.handler);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAccountUnreadCount(" \n\t ", true), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(recorder.calls).toEqual([]);
  });

  it("throws an explicit error when a trim-empty account id queryFn is executed directly", async () => {
    const recorder = createTauriMockCallRecorder();
    setupTauriMocks(recorder.handler);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAccountUnreadCount(" \n\t ", true), { wrapper });

    await expect(result.current.refetch({ throwOnError: true })).rejects.toThrow(
      "Account unread count requires a non-empty account id.",
    );
    expect(recorder.calls).toEqual([]);
  });

  it("trims account ids before calling the unread count command", async () => {
    const recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "count_account_unread_articles") {
        return 3;
      }

      return undefined;
    });
    setupTauriMocks(recorder.handler);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAccountUnreadCount(" acc-1 ", true), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe(3);
    });
    expect(recorder.calls).toContainEqual({
      cmd: "count_account_unread_articles",
      args: { accountId: "acc-1" },
    });
  });

  it("uses the shared account unread query key helper after trimming ids", async () => {
    const recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "count_account_unread_articles") {
        return 5;
      }

      return undefined;
    });
    setupTauriMocks(recorder.handler);
    const { queryClient, wrapper } = createQueryWrapper();

    renderHook(() => useAccountUnreadCount(" acc-1 ", true), { wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.accountUnreadCount.byAccount("acc-1"))).toBe(5);
    });
    expect(queryClient.getQueryState([...queryKeys.accountUnreadCount.root, " acc-1 "])).toBeUndefined();
  });
});
