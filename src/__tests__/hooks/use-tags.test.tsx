import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import {
  resolveTagMutationInvalidationQueryKeys,
  tagQueryKeys,
  useArticlesByTag,
  useCreateTag,
  useDeleteTag,
  useRenameTag,
  useTagArticle,
  useTagArticleCounts,
  useTags,
  useUntagArticle,
} from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";

describe("tag query keys", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
  });

  it("keeps mutation invalidation roots aligned with hook query roots", async () => {
    vi.spyOn(tauriCommands, "listTags").mockResolvedValue(Result.succeed([]));
    vi.spyOn(tauriCommands, "getTagArticleCounts").mockResolvedValue(Result.succeed({}));
    vi.spyOn(tauriCommands, "listArticlesByTag").mockResolvedValue(Result.succeed([]));

    renderHook(() => useTags(), { wrapper });
    renderHook(() => useTagArticleCounts("acc-1"), { wrapper });
    renderHook(() => useArticlesByTag("tag-1", "acc-1"), { wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryState(tagQueryKeys.tags.root)).toBeDefined();
      expect(queryClient.getQueryState(tagQueryKeys.tagArticleCounts.byAccount("acc-1"))).toBeDefined();
      expect(
        queryClient.getQueryState(tagQueryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "all")),
      ).toBeDefined();
    });

    expect(resolveTagMutationInvalidationQueryKeys("create")).toEqual([tagQueryKeys.tags.root]);
    expect(resolveTagMutationInvalidationQueryKeys("articleAssignment")).toEqual([
      tagQueryKeys.articleTags.root,
      tagQueryKeys.articlesByTag.root,
      tagQueryKeys.tagArticleCounts.root,
    ]);
    expect(resolveTagMutationInvalidationQueryKeys("metadata")).toEqual([
      tagQueryKeys.tags.root,
      tagQueryKeys.articleTags.root,
      tagQueryKeys.articlesByTag.root,
      tagQueryKeys.tagArticleCounts.root,
    ]);
  });
});

describe("useArticlesByTag", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
  });

  it("keeps null tag queries disabled and calls the API when a tag id is available", async () => {
    const listArticlesByTagSpy = vi
      .spyOn(tauriCommands, "listArticlesByTag")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const initialProps: { tagId: string | null; accountId: string | null } = {
      tagId: null,
      accountId: "acc-1",
    };

    const { rerender } = renderHook(
      ({ tagId, accountId }: { tagId: string | null; accountId: string | null }) => useArticlesByTag(tagId, accountId),
      {
        initialProps,
        wrapper,
      },
    );

    expect(listArticlesByTagSpy).not.toHaveBeenCalled();

    rerender({ tagId: "tag-1", accountId: "acc-1" });

    await waitFor(() => {
      expect(listArticlesByTagSpy).toHaveBeenCalledWith("tag-1", undefined, undefined, "acc-1", "all");
    });
  });

  it("keeps whitespace-only tag queries disabled", () => {
    const listArticlesByTagSpy = vi
      .spyOn(tauriCommands, "listArticlesByTag")
      .mockResolvedValue(Result.succeed(sampleArticles));

    renderHook(() => useArticlesByTag("   ", "acc-1"), { wrapper });

    expect(listArticlesByTagSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(["articlesByTag", null, "acc-1", { mode: "all" }])?.fetchStatus).toBe("idle");
  });

  it("trims valid tag ids for the query key and fetches with account and mode", async () => {
    const listArticlesByTagSpy = vi
      .spyOn(tauriCommands, "listArticlesByTag")
      .mockResolvedValue(Result.succeed(sampleArticles));

    renderHook(() => useArticlesByTag(" tag-1 ", "acc-1", { mode: "unread" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(listArticlesByTagSpy).toHaveBeenCalledWith("tag-1", undefined, undefined, "acc-1", "unread");
    });
    expect(queryClient.getQueryData(["articlesByTag", "tag-1", "acc-1", { mode: "unread" }])).toEqual(sampleArticles);
  });
});

describe("useTagArticleCounts", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
  });

  it("normalizes null and undefined to one all-account key separated from selected accounts", async () => {
    const getTagArticleCountsSpy = vi
      .spyOn(tauriCommands, "getTagArticleCounts")
      .mockResolvedValueOnce(Result.succeed({ "tag-all": 2 }))
      .mockResolvedValueOnce(Result.succeed({ "tag-acc-1": 1 }));
    const initialProps: { accountId: string | null | undefined } = {
      accountId: undefined,
    };

    const { rerender } = renderHook(
      ({ accountId }: { accountId: string | null | undefined }) => useTagArticleCounts(accountId),
      {
        initialProps,
        wrapper,
      },
    );

    await waitFor(() => {
      expect(getTagArticleCountsSpy).toHaveBeenCalledWith(undefined);
    });

    rerender({ accountId: null });

    await waitFor(() => {
      expect(queryClient.getQueryData(["tagArticleCounts", null])).toEqual({
        "tag-all": 2,
      });
    });
    expect(getTagArticleCountsSpy).toHaveBeenCalledTimes(1);

    rerender({ accountId: "acc-1" });

    await waitFor(() => {
      expect(getTagArticleCountsSpy).toHaveBeenCalledWith("acc-1");
    });
    expect(queryClient.getQueryData(["tagArticleCounts", null])).toEqual({
      "tag-all": 2,
    });
    expect(queryClient.getQueryData(["tagArticleCounts", "acc-1"])).toEqual({
      "tag-acc-1": 1,
    });
  });
});

describe("article tag mutations", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: {
        defaultOptions: {
          mutations: { retry: false },
        },
      },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    vi.restoreAllMocks();
    useUiStore.setState({ selection: { type: "all" } });
  });

  it("invalidates the tag list after creating a tag without changing article count caches", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "createTag").mockResolvedValue(
      Result.succeed({
        id: "tag-new",
        name: "Review",
        color: null,
      }),
    );

    const { result } = renderHook(() => useCreateTag(), { wrapper });

    await result.current.mutateAsync({ name: "Review" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["tagArticleCounts"],
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["articlesByTag"],
    });
  });

  it("invalidates article tag assignment caches after assigning a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "tagArticle").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useTagArticle(), { wrapper });

    await result.current.mutateAsync({ articleId: "art-1", tagId: "tag-1" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articleTags"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articlesByTag"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["tagArticleCounts"],
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["tags"],
    });
  });

  it("marks article and tag assignment caches stale after assigning a tag", async () => {
    vi.spyOn(tauriCommands, "tagArticle").mockResolvedValue(Result.succeed(null));
    queryClient.setQueryData(["articleTags", "art-1"], [{ id: "tag-1", name: "Review", color: null }]);
    queryClient.setQueryData(["articlesByTag", "tag-1", "acc-1", { mode: "all" }], sampleArticles);
    queryClient.setQueryData(["tagArticleCounts", "acc-1"], { "tag-1": 1 });
    queryClient.setQueryData(["articles", "feed-1", { mode: "all" }], sampleArticles);
    queryClient.setQueryData(["accountArticles", "acc-1", { mode: "all" }], sampleArticles);

    const { result } = renderHook(() => useTagArticle(), { wrapper });

    await result.current.mutateAsync({ articleId: "art-1", tagId: "tag-2" });

    expect(queryClient.getQueryState(["articleTags", "art-1"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["articlesByTag", "tag-1", "acc-1", { mode: "all" }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["tagArticleCounts", "acc-1"])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["articles", "feed-1", { mode: "all" }])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(["accountArticles", "acc-1", { mode: "all" }])?.isInvalidated).toBe(true);
  });

  it("invalidates article tag assignment caches after unassigning a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "untagArticle").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUntagArticle(), { wrapper });

    await result.current.mutateAsync({ articleId: "art-1", tagId: "tag-1" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articleTags"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articlesByTag"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["tagArticleCounts"],
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ["tags"],
    });
  });

  it("invalidates tag metadata and article count caches after renaming a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "renameTag").mockResolvedValue(
      Result.succeed({
        id: "tag-1",
        name: "Renamed",
        color: "#6f8eb8",
      }),
    );

    const { result } = renderHook(() => useRenameTag(), { wrapper });

    await result.current.mutateAsync({
      tagId: "tag-1",
      name: "Renamed",
      color: "#6f8eb8",
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articleTags"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articlesByTag"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["tagArticleCounts"],
    });
  });

  it("invalidates tag metadata and article count caches after deleting a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "deleteTag").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await result.current.mutateAsync({ tagId: "tag-1" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tags"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articleTags"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["articlesByTag"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["tagArticleCounts"],
    });
  });

  it("falls back to all after deleting the currently selected tag", async () => {
    vi.spyOn(tauriCommands, "deleteTag").mockResolvedValue(Result.succeed(null));
    useUiStore.getState().selectTag("tag-1");

    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await result.current.mutateAsync({ tagId: "tag-1" });

    expect(useUiStore.getState().selection).toEqual({ type: "all" });
  });

  it("keeps selection after deleting a different tag", async () => {
    vi.spyOn(tauriCommands, "deleteTag").mockResolvedValue(Result.succeed(null));
    useUiStore.getState().selectTag("tag-1");

    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await result.current.mutateAsync({ tagId: "tag-2" });

    expect(useUiStore.getState().selection).toEqual({
      type: "tag",
      tagId: "tag-1",
    });
  });
});
