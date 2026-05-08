import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useArticlesByTag } from "@/hooks/use-tags";

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
