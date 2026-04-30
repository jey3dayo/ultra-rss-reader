import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";

describe("useAccountSyncStatus", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

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
        wrapper: createWrapper(),
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
});
