import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

describe("useUpdateFeedFolder", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let showToastMock: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({ queryClientConfig: { defaultOptions: { mutations: { retry: false } } } });
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
    queryClient.setQueryData<FeedDto[]>(
      ["feeds", "acc-1"],
      [
        {
          id: "feed-1",
          account_id: "acc-1",
          folder_id: null,
          title: "Tech Blog",
          url: "https://example.com/feed.xml",
          site_url: "https://example.com",
          unread_count: 5,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        },
      ],
    );
  }

  it("invalidates feeds after a successful folder update", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries");
    const updateFeedFolderSpy = vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" });

    expect(updateFeedFolderSpy).toHaveBeenCalledWith("feed-1", "folder-1");
    await waitFor(() => {
      expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
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
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-1",
        }),
      ]);
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
    let resolveUpdate: ((value: Result.Result<null, { type: "UserVisible"; message: string }>) => void) | null = null;
    vi.spyOn(tauriCommands, "updateFeedFolder").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });
    let mutationPromise: Promise<unknown> | undefined;

    act(() => {
      mutationPromise = result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: "folder-1",
        }),
      ]);
    });

    await waitFor(() => {
      expect(resolveUpdate).not.toBeNull();
    });

    await act(async () => {
      resolveUpdate?.(Result.fail({ type: "UserVisible", message: "boom" }));
      await mutationPromise;
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith("Failed to update folder: boom");
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          folder_id: null,
        }),
      ]);
    });
  });
});
