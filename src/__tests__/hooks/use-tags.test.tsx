import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useArticlesByTag } from "@/hooks/use-tags";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

describe("useArticlesByTag", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it("keeps null tag queries disabled and calls the API when a tag id is available", async () => {
    const listArticlesByTagSpy = vi
      .spyOn(tauriCommands, "listArticlesByTag")
      .mockResolvedValue(Result.succeed(sampleArticles));

    const { rerender } = renderHook(
      ({ tagId, accountId }: { tagId: string | null; accountId: string | null }) =>
        useArticlesByTag(tagId, accountId),
      {
        initialProps: { tagId: null, accountId: "acc-1" },
        wrapper: createWrapper(),
      },
    );

    expect(listArticlesByTagSpy).not.toHaveBeenCalled();

    rerender({ tagId: "tag-1", accountId: "acc-1" });

    await waitFor(() => {
      expect(listArticlesByTagSpy).toHaveBeenCalledWith("tag-1", undefined, undefined, "acc-1");
    });
  });
});
