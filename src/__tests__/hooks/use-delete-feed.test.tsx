import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import type { ToastData } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

describe("useDeleteFeed", () => {
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

  it("invalidates feed-related queries and shows a success toast", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const deleteFeedSpy = vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.succeed(null));
    const onSuccess = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await result.current.mutateAsync({ feedId: "feed-1", title: "Tech Blog", onSuccess });

    expect(deleteFeedSpy).toHaveBeenCalledWith("feed-1");
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["accountUnreadCount"] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["accountArticles"] });
    });
    expect(showToastMock).toHaveBeenCalledWith("Unsubscribed from Tech Blog");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows a failure toast, calls onError, and rejects on delete failure", async () => {
    vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.fail({ type: "UserVisible", message: "boom" }));
    const onError = vi.fn();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", title: "Tech Blog", onError })).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to unsubscribe: boom");
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
