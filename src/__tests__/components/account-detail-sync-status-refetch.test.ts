import { beforeEach, describe, expect, it, vi } from "vitest";
import { refetchAccountSyncStatusWithErrorSurface } from "@/components/settings/account-detail/sync-status-refetch";

describe("refetchAccountSyncStatusWithErrorSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces rejected sync status refetches without rethrowing", async () => {
    const error = new Error("status refetch failed");
    const refetch = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    refetchAccountSyncStatusWithErrorSurface(refetch);
    await Promise.resolve();

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("Failed to refetch account sync status.", error);
    consoleError.mockRestore();
  });
});
