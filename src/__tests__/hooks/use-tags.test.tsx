import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useArticlesByTag, useTagArticle, useUntagArticle } from "@/hooks/use-tags";

describe("useArticlesByTag", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    wrapper = createQueryWrapper().wrapper;
    vi.restoreAllMocks();
  });

  it("keeps null tag queries disabled and calls the API when a tag id is available", async () => {
    const listArticlesByTagSpy = vi
      .spyOn(tauriCommands, "listArticlesByTag")
      .mockResolvedValue(Result.succeed(sampleArticles));
    const initialProps: { tagId: string | null; accountId: string | null } = { tagId: null, accountId: "acc-1" };

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
  });

  it("invalidates article tag assignment caches after assigning a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "tagArticle").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useTagArticle(), { wrapper });

    await result.current.mutateAsync({ articleId: "art-1", tagId: "tag-1" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["articleTags"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["articlesByTag"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tagArticleCounts"] });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({ queryKey: ["tags"] });
  });

  it("invalidates article tag assignment caches after unassigning a tag", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "untagArticle").mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => useUntagArticle(), { wrapper });

    await result.current.mutateAsync({ articleId: "art-1", tagId: "tag-1" });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["articleTags"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["articlesByTag"] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tagArticleCounts"] });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({ queryKey: ["tags"] });
  });
});
