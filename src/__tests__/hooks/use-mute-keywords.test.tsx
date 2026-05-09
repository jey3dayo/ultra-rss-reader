import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  MUTE_KEYWORD_QUERY_KEY,
  resolveMuteKeywordInvalidationQueryKeys,
  useCreateMuteKeyword,
  useDeleteMuteKeyword,
  useMuteKeywords,
  useUpdateMuteKeyword,
} from "@/hooks/use-mute-keywords";

const articleCacheInvalidationKeys = [
  ["articles"],
  ["accountArticles"],
  ["folderArticles"],
  ["starredArticles"],
  ["accountUnreadCount"],
  ["accountStarredCount"],
  ["feeds"],
  ["articlesByTag"],
  ["tagArticleCounts"],
  ["search"],
  ["recentArticles"],
];

function expectMuteKeywordArticleCacheInvalidation(invalidateQueriesSpy: ReturnType<typeof vi.fn>) {
  expect(invalidateQueriesSpy.mock.calls.map(([options]) => options)).toEqual([
    { queryKey: ["muteKeywords"] },
    ...articleCacheInvalidationKeys.map((queryKey) => ({ queryKey })),
  ]);
}

describe("mute keyword mutations", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let invalidateQueriesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          mutations: { retry: false },
        },
      },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
  });

  it("uses the same mute keyword root query key for querying and invalidation", async () => {
    vi.spyOn(tauriCommands, "listMuteKeywords").mockResolvedValue(Result.succeed([]));

    renderHook(() => useMuteKeywords(), { wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryCache().find({ queryKey: MUTE_KEYWORD_QUERY_KEY })?.queryKey).toBe(
        MUTE_KEYWORD_QUERY_KEY,
      );
    });

    expect(resolveMuteKeywordInvalidationQueryKeys()[0]).toBe(MUTE_KEYWORD_QUERY_KEY);
  });

  it("invalidates mute keyword and article caches after creating a mute keyword", async () => {
    vi.spyOn(tauriCommands, "createMuteKeyword").mockResolvedValue(
      Result.succeed({
        id: "mute-1",
        keyword: "spoiler",
        scope: "title",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:00:00Z",
      }),
    );

    const { result } = renderHook(() => useCreateMuteKeyword(), { wrapper });

    await result.current.mutateAsync({ keyword: "spoiler", scope: "title" });

    await waitFor(() => {
      expectMuteKeywordArticleCacheInvalidation(invalidateQueriesSpy);
    });
  });

  it("keeps mute keyword creation successful when post-success invalidation fails", async () => {
    const invalidationError = new Error("mute cache refresh failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    invalidateQueriesSpy.mockRejectedValue(invalidationError);
    vi.spyOn(tauriCommands, "createMuteKeyword").mockResolvedValue(
      Result.succeed({
        id: "mute-1",
        keyword: "spoiler",
        scope: "title",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:00:00Z",
      }),
    );

    const { result } = renderHook(() => useCreateMuteKeyword(), { wrapper });

    await expect(result.current.mutateAsync({ keyword: "spoiler", scope: "title" })).resolves.toEqual({
      id: "mute-1",
      keyword: "spoiler",
      scope: "title",
      created_at: "2026-05-09T00:00:00Z",
      updated_at: "2026-05-09T00:00:00Z",
    });
    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("Query invalidation failed:", {
        queryKey: ["muteKeywords"],
        error: invalidationError,
      });
    });
  });

  it("invalidates mute keyword and article caches after updating a mute keyword", async () => {
    vi.spyOn(tauriCommands, "updateMuteKeyword").mockResolvedValue(
      Result.succeed({
        id: "mute-1",
        keyword: "spoiler",
        scope: "title_and_body",
        created_at: "2026-05-09T00:00:00Z",
        updated_at: "2026-05-09T00:05:00Z",
      }),
    );

    const { result } = renderHook(() => useUpdateMuteKeyword(), { wrapper });

    await result.current.mutateAsync({
      muteKeywordId: "mute-1",
      scope: "title_and_body",
    });

    await waitFor(() => {
      expectMuteKeywordArticleCacheInvalidation(invalidateQueriesSpy);
    });
  });

  it("invalidates mute keyword and article caches after deleting a mute keyword", async () => {
    vi.spyOn(tauriCommands, "deleteMuteKeyword").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useDeleteMuteKeyword(), { wrapper });

    await result.current.mutateAsync({ muteKeywordId: "mute-1" });

    await waitFor(() => {
      expectMuteKeywordArticleCacheInvalidation(invalidateQueriesSpy);
    });
  });
});
