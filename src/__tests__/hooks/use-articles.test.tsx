import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useToggleStar } from "@/hooks/use-articles";
import { sampleArticles, sampleFeeds } from "../../../tests/helpers/tauri-mocks";

describe("useToggleStar", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it("patches cached account and starred article data immediately when starring an article", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
    });
  });

  it("patches cached account data and removes the article from starred caches when unstarring", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.is_starred),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("injects the updated article into account caches when unstarring a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(
      ["accountArticles", "acc-1"],
      sampleArticles.filter((article) => article.id !== "art-2"),
    );
    queryClient.setQueryData(
      ["starredArticles", "acc-1"],
      sampleArticles.filter((article) => article.id === "art-2"),
    );

    const { result } = renderHook(() => useToggleStar(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-2", is_starred: false })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("creates the matching account cache when unstarring from a starred-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["feeds", "acc-1"], sampleFeeds);
    queryClient.setQueryData(["starredArticles", "acc-1"], [sampleArticles[1]]);

    const { result } = renderHook(() => useToggleStar(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: "art-2", starred: false });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual([
        expect.objectContaining({ id: "art-2", is_starred: false }),
      ]);
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([]);
    });
  });

  it("creates the matching starred cache when starring from an account-only selection", async () => {
    vi.spyOn(tauriCommands, "toggleArticleStar").mockResolvedValue(Result.succeed(null));

    queryClient.setQueryData(["feeds", "acc-1"], sampleFeeds);
    queryClient.setQueryData(["accountArticles", "acc-1"], sampleArticles);

    const { result } = renderHook(() => useToggleStar(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ id: "art-1", starred: true });

    await waitFor(() => {
      expect(queryClient.getQueryData(["accountArticles", "acc-1"])).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "art-1", is_starred: true })]),
      );
      expect(queryClient.getQueryData(["starredArticles", "acc-1"])).toEqual([
        expect.objectContaining({ id: "art-1", is_starred: true }),
      ]);
    });
  });
});
