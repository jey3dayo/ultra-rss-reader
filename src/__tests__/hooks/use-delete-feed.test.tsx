import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useDeleteFeed } from "@/hooks/use-delete-feed";
import { queryKeys } from "@/lib/query/query-invalidation";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

describe("useDeleteFeed", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let showToastMock: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: { defaultOptions: { mutations: { retry: false } } },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
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

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await result.current.mutateAsync({
      feedId: "feed-1",
      accountId: "acc-1",
      title: "Tech Blog",
      onSuccess,
    });

    expect(deleteFeedSpy).toHaveBeenCalledWith("feed-1");
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["feeds"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["folders"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["accountUnreadCount"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["articles"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["accountArticles"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["search"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["recentArticles"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["tagArticleCounts"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.feedArticleSummaries.subscriptionsIndex("acc-1"),
      });
    });
    expect(showToastMock).toHaveBeenCalledWith("Unsubscribed from Tech Blog");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful delete successful when the optional success callback throws", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const deleteFeedSpy = vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.succeed(null));
    const onSuccess = vi.fn(() => {
      throw new Error("callback boom");
    });

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedId: "feed-1",
        accountId: "acc-1",
        title: "Tech Blog",
        onSuccess,
      }),
    ).resolves.toBeNull();

    expect(deleteFeedSpy).toHaveBeenCalledWith("feed-1");
    expect(showToastMock).toHaveBeenCalledWith("Unsubscribed from Tech Blog");
    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["feeds"],
      });
    });
  });

  it("keeps a successful delete successful when cache invalidation rejects", async () => {
    const invalidationError = new Error("invalidate failed");
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(invalidationError);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedId: "feed-1",
        accountId: "acc-1",
        title: "Tech Blog",
      }),
    ).resolves.toBeNull();

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Query invalidation failed:", {
        actionOwner: "delete-feed",
        queryKey: ["feeds"],
        error: invalidationError,
      });
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(showToastMock).toHaveBeenCalledWith("Unsubscribed from Tech Blog");
  });

  it("shows a failure toast, calls onError, and rejects on delete failure", async () => {
    vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.fail({ type: "UserVisible", message: "boom" }));
    const onError = vi.fn();

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedId: "feed-1",
        accountId: "acc-1",
        title: "Tech Blog",
        onError,
      }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to unsubscribe: boom");
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps the delete failure reason when the optional error callback throws", async () => {
    vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.fail({ type: "UserVisible", message: "boom" }));
    const onError = vi.fn(() => {
      throw new Error("callback boom");
    });

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedId: "feed-1",
        accountId: "acc-1",
        title: "Tech Blog",
        onError,
      }),
    ).rejects.toMatchObject({ message: "boom" });

    expect(showToastMock).toHaveBeenCalledWith("Failed to unsubscribe: boom");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("rejects blank feed ids before calling the delete command", async () => {
    const deleteFeedSpy = vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await expect(
      result.current.mutateAsync({
        feedId: " \n ",
        accountId: "acc-1",
        title: "Tech Blog",
      }),
    ).rejects.toMatchObject({ message: "Feed id is required" });

    expect(deleteFeedSpy).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith("Failed to unsubscribe: Feed id is required");
  });

  it("falls back to the feed id when the success toast title is blank", async () => {
    vi.spyOn(tauriCommands, "deleteFeed").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useDeleteFeed(), { wrapper });

    await result.current.mutateAsync({
      feedId: "feed-1",
      accountId: "acc-1",
      title: " \n ",
    });

    expect(showToastMock).toHaveBeenCalledWith("Unsubscribed from feed-1");
  });
});
