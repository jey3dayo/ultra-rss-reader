import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { message?: string }) => `${key}:${options?.message ?? ""}`,
    }),
  };
});

describe("useUpdateFeedDisplaySettings", () => {
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
    vi.restoreAllMocks();
  });

  function seedFeeds() {
    queryClient.setQueryData<FeedDto[]>(
      ["feeds", "acc-1"],
      [
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
      ],
    );
  }

  function createHook() {
    return renderHook(() => useUpdateFeedDisplaySettings(), { wrapper });
  }

  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    });
    return { promise, resolve };
  }

  it("optimistically updates display settings and invalidates feeds on success", async () => {
    seedFeeds();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const updateFeedDisplaySettingsSpy = vi
      .spyOn(tauriCommands, "updateFeedDisplaySettings")
      .mockResolvedValue(Result.succeed(null));
    const { result } = createHook();

    await expect(result.current("feed-1", "on", "on")).resolves.toBe(true);

    expect(updateFeedDisplaySettingsSpy).toHaveBeenCalledWith("feed-1", "on", "on");
    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "on",
        web_preview_mode: "on",
      }),
    ]);
    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    });
  });

  it("rolls back display settings and shows a toast on failure", async () => {
    seedFeeds();
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries");
    vi.spyOn(tauriCommands, "updateFeedDisplaySettings").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );
    const { result } = createHook();

    await expect(result.current("feed-1", "on", "on")).resolves.toBe(false);

    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      }),
    ]);
    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(showToastMock).toHaveBeenCalledWith("failed_to_update_display_settings:boom");
  });

  it("stops before optimistic update when feed query cancellation rejects", async () => {
    seedFeeds();
    vi.spyOn(queryClient, "cancelQueries").mockRejectedValue(new Error("cancel boom"));
    const updateFeedDisplaySettingsSpy = vi
      .spyOn(tauriCommands, "updateFeedDisplaySettings")
      .mockResolvedValue(Result.succeed(null));
    const { result } = createHook();

    await expect(result.current("feed-1", "on", "on")).rejects.toThrow("cancel boom");

    expect(updateFeedDisplaySettingsSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      }),
    ]);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("keeps optimistic display settings when a stale feeds refetch resolves later", async () => {
    seedFeeds();
    const staleFeeds: FeedDto[] = [
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
    ];
    const deferredRefetch = createDeferred<FeedDto[]>();
    await queryClient.invalidateQueries({ queryKey: ["feeds", "acc-1"] });
    let refetchStarted = false;
    const staleRefetch = queryClient.fetchQuery({
      queryKey: ["feeds", "acc-1"],
      queryFn: ({ signal }) =>
        new Promise<FeedDto[]>((resolve, reject) => {
          refetchStarted = true;
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          deferredRefetch.promise.then(resolve);
        }),
    });
    vi.spyOn(tauriCommands, "updateFeedDisplaySettings").mockResolvedValue(Result.succeed(null));
    const { result } = createHook();

    await waitFor(() => {
      expect(refetchStarted).toBe(true);
    });
    await expect(result.current("feed-1", "on", "on")).resolves.toBe(true);

    deferredRefetch.resolve(staleFeeds);
    await expect(staleRefetch).resolves.toEqual(staleFeeds);

    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "on",
        web_preview_mode: "on",
      }),
    ]);
  });

  it("does not leave optimistic display settings behind when a canceled update fails", async () => {
    seedFeeds();
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries");
    let resolveUpdate: (result: Awaited<ReturnType<typeof tauriCommands.updateFeedDisplaySettings>>) => void = () => {};
    vi.spyOn(tauriCommands, "updateFeedDisplaySettings").mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const { result } = createHook();

    const promise = result.current("feed-1", "on", "on");

    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          reader_mode: "on",
          web_preview_mode: "on",
        }),
      ]);
    });

    resolveUpdate(Result.fail({ type: "UserVisible", message: "boom" }));
    await expect(promise).resolves.toBe(false);

    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      }),
    ]);
  });

  it("does not let an older failed update roll back the latest display settings", async () => {
    seedFeeds();
    const firstUpdate = createDeferred<Awaited<ReturnType<typeof tauriCommands.updateFeedDisplaySettings>>>();
    const secondUpdate = createDeferred<Awaited<ReturnType<typeof tauriCommands.updateFeedDisplaySettings>>>();
    vi.spyOn(tauriCommands, "updateFeedDisplaySettings")
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);
    const { result } = createHook();

    const firstPromise = result.current("feed-1", "on", "on");
    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          reader_mode: "on",
          web_preview_mode: "on",
        }),
      ]);
    });

    const secondPromise = result.current("feed-1", "off", "off");
    await waitFor(() => {
      expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
        expect.objectContaining({
          id: "feed-1",
          reader_mode: "off",
          web_preview_mode: "off",
        }),
      ]);
    });

    secondUpdate.resolve(Result.succeed(null));
    await expect(secondPromise).resolves.toBe(true);

    firstUpdate.resolve(Result.fail({ type: "UserVisible", message: "stale boom" }));
    await expect(firstPromise).resolves.toBe(false);

    expect(queryClient.getQueryData<FeedDto[]>(["feeds", "acc-1"])).toEqual([
      expect.objectContaining({
        id: "feed-1",
        reader_mode: "off",
        web_preview_mode: "off",
      }),
    ]);
    expect(showToastMock).not.toHaveBeenCalledWith("failed_to_update_display_settings:stale boom");
  });
});
