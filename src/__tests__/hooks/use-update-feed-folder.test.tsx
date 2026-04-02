import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import type { ToastData } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

describe("useUpdateFeedFolder", () => {
  let queryClient: QueryClient;
  let showToastMock: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    showToastMock = vi.fn();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ showToast: showToastMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("invalidates feeds after a successful folder update", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const updateFeedFolderSpy = vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" });

    expect(updateFeedFolderSpy).toHaveBeenCalledWith("feed-1", "folder-1");
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    });
  });

  it("shows a toast and rejects when the folder update fails", async () => {
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: null })).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: boom");
    });
  });
});
