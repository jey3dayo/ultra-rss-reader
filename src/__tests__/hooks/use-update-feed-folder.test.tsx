import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expectTauriCommandError, suppressConsoleError, suppressConsoleWarn } from "@tests/helpers/console-spies";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, FeedDto } from "@/api/tauri-commands";
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
    teardownTauriMocks();
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

  function deferredTauriUpdate() {
    let resolveUpdate: ((value: Result.Result<null, AppError>) => void) | null = null;
    const promise = new Promise<Result.Result<null, AppError>>((resolve) => {
      resolveUpdate = resolve;
    }).then((result) => {
      if (Result.isFailure(result)) {
        throw Result.unwrapError(result);
      }
      return Result.unwrap(result);
    });

    return {
      promise,
      resolve(value: Result.Result<null, AppError>) {
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
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "boom" };
    setupTauriMocks((cmd) => {
      if (cmd === "update_feed_folder") {
        throw appError;
      }
      return undefined;
    });

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: null })).rejects.toBeDefined();

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: boom");
    });
    expectTauriCommandError(consoleError, "update_feed_folder", appError);
  });

  it("rolls back cached feeds when the folder update fails", async () => {
    seedFeeds();
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "boom" };
    const update = deferredTauriUpdate();
    setupTauriMocks((cmd) => {
      if (cmd === "update_feed_folder") {
        return update.promise;
      }
      return undefined;
    });

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
      update.resolve(Result.fail(appError));
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
    expectTauriCommandError(consoleError, "update_feed_folder", appError);
  });

  it("does not let an older failed drop roll back a newer successful folder update", async () => {
    seedFeeds();
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "first failed" };
    const firstUpdate = deferredTauriUpdate();
    const secondUpdate = deferredTauriUpdate();
    const updates = [firstUpdate, secondUpdate];
    setupTauriMocks((cmd) => {
      if (cmd === "update_feed_folder") {
        return updates.shift()?.promise;
      }
      return undefined;
    });

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
      firstUpdate.resolve(Result.fail(appError));
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
    expectTauriCommandError(consoleError, "update_feed_folder", appError);
  });

  it("does not let a failed update roll back cache data that no longer matches its optimistic target", async () => {
    seedFeeds();
    const consoleError = suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "stale failed" };
    const update = deferredTauriUpdate();
    setupTauriMocks((cmd) => {
      if (cmd === "update_feed_folder") {
        return update.promise;
      }
      return undefined;
    });

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });
    let mutationPromise: Promise<unknown> | undefined;

    act(() => {
      mutationPromise = result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-a" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-a",
        }),
      ]);
    });

    queryClient.setQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"), [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: "folder-b",
        remote_id: null,
        title: "Tech Blog",
        url: "https://example.com/feed.xml",
        site_url: "https://example.com",
        unread_count: 5,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ]);

    await act(async () => {
      update.resolve(Result.fail(appError));
      await mutationPromise;
    });

    expect(queryClient.getQueryData<FeedDto[]>(queryKeys.feeds.byAccount("acc-1"))).toEqual([
      expect.objectContaining({
        id: "feed-1",
        folder_id: "folder-b",
      }),
    ]);
    expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: stale failed");
    expectTauriCommandError(consoleError, "update_feed_folder", appError);
  });

  it("keeps a successful folder update resolved when post-success invalidation rejects", async () => {
    seedFeeds();
    const consoleWarn = suppressConsoleWarn();
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("invalidate boom"));
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" })).resolves.toBeNull();

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith("Query invalidation failed:", {
        failures: expect.arrayContaining([
          expect.objectContaining({
            actionOwner: "unknown",
            queryKey: queryKeys.feeds.root,
            error: expect.any(Error),
          }),
        ]),
      });
    });
    expect(showToastMock).not.toHaveBeenCalled();
  });
});
