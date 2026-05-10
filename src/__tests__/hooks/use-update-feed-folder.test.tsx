import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { queryKeys } from "@/lib/query/query-invalidation";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

describe("useUpdateFeedFolder", () => {
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

  function seedFeeds() {
    queryClient.setQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"), [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Tech Blog",
        url: "https://example.com/feed.xml",
        site_url: "https://example.com",
        unread_count: 5,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ]);
  }

  function deferredUpdate() {
    let resolveUpdate: ((value: Result.Result<null, { type: "UserVisible"; message: string }>) => void) | null = null;
    const promise = new Promise<Result.Result<null, { type: "UserVisible"; message: string }>>((resolve) => {
      resolveUpdate = resolve;
    });

    return {
      promise,
      resolve(value: Result.Result<null, { type: "UserVisible"; message: string }>) {
        if (!resolveUpdate) {
          throw new Error("Update promise has not been captured");
        }
        resolveUpdate(value);
      },
    };
  }

  it("invalidates feeds after a successful folder update", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries");
    const updateFeedFolderSpy = vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await result.current.mutateAsync({
      feedId: "feed-1",
      folderId: "folder-1",
    });

    expect(updateFeedFolderSpy).toHaveBeenCalledWith("feed-1", "folder-1");
    await waitFor(() => {
      expect(cancelQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.feeds.root,
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.feeds.root,
      });
    });
  });

  it("optimistically updates cached feeds before the folder update resolves", async () => {
    seedFeeds();
    vi.spyOn(tauriCommands, "updateFeedFolder").mockImplementation(() => new Promise<never>(() => {}));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    act(() => {
      result.current.mutate({ feedId: "feed-1", folderId: "folder-1" });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-1",
        }),
      ]);
    });
  });

  it("stops before optimistic update when feed query cancellation rejects", async () => {
    seedFeeds();
    vi.spyOn(queryClient, "cancelQueries").mockRejectedValue(new Error("cancel boom"));
    const updateFeedFolderSpy = vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" })).rejects.toBeDefined();

    expect(updateFeedFolderSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
      expect.objectContaining({
        id: "feed-1",
        folder_id: null,
      }),
    ]);
    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: cancel boom");
    });
  });

  it("shows a toast and rejects when the folder update fails", async () => {
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: null })).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: boom");
    });
  });

  it("rolls back cached feeds when the folder update fails", async () => {
    seedFeeds();
    const update = deferredUpdate();
    vi.spyOn(tauriCommands, "updateFeedFolder").mockReturnValue(update.promise);

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });
    let mutationPromise: Promise<unknown> | undefined;

    act(() => {
      mutationPromise = result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-1",
        }),
      ]);
    });

    await act(async () => {
      update.resolve(Result.fail({ type: "UserVisible", message: "boom" }));
      await mutationPromise;
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: boom");
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: null,
        }),
      ]);
    });
  });

  it("does not let an older failed drop roll back a newer successful folder update", async () => {
    seedFeeds();
    const firstUpdate = deferredUpdate();
    const secondUpdate = deferredUpdate();
    vi.spyOn(tauriCommands, "updateFeedFolder")
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });
    let firstMutation: Promise<unknown> | undefined;
    let secondMutation: Promise<unknown> | undefined;

    act(() => {
      firstMutation = result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-a" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-a",
        }),
      ]);
    });

    act(() => {
      secondMutation = result.current.mutateAsync({
        feedId: "feed-1",
        folderId: "folder-b",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-b",
        }),
      ]);
    });

    await act(async () => {
      firstUpdate.resolve(Result.fail({ type: "UserVisible", message: "first failed" }));
      secondUpdate.resolve(Result.succeed(null));
      await firstMutation;
      await secondMutation;
    });

    expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
      expect.objectContaining({
        id: "feed-1",
        folder_id: "folder-b",
      }),
    ]);
    expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: first failed");
  });

  it("keeps a successful folder update resolved when post-success invalidation rejects", async () => {
    seedFeeds();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("invalidate boom"));
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" })).resolves.toBeNull();

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith("Query invalidation failed:", {
        actionOwner: "unknown",
        queryKey: queryKeys.feeds.root,
        error: expect.any(Error),
      });
    });
    expect(showToastMock).not.toHaveBeenCalled();
  });
});
