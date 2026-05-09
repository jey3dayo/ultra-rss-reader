import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { createTauriMockCallRecorder, setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { useAccountUnreadCount } from "@/hooks/use-account-unread-count";

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
});
