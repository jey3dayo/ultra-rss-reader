import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useFeedArticleSummaries } from "@/components/subscriptions-index/hooks/use-feed-article-summaries";

type HookProps = {
  accountId: string | null;
};

describe("useFeedArticleSummaries", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];

  beforeEach(() => {
    wrapper = createQueryWrapper().wrapper;
    vi.restoreAllMocks();
  });

  it("keeps the query disabled without an account id and clears previous account data", async () => {
    const initialProps: HookProps = { accountId: "acc-1" };
    const listFeedArticleSummariesSpy = vi
      .spyOn(tauriCommands, "listFeedArticleSummaries")
      .mockResolvedValue(
        Result.succeed([{ feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 }]),
      );

    const { result, rerender } = renderHook(({ accountId }: HookProps) => useFeedArticleSummaries(accountId), {
      initialProps,
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 },
      ]);
    });

    rerender({ accountId: null });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(listFeedArticleSummariesSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the query disabled for a whitespace-only account id", () => {
    const listFeedArticleSummariesSpy = vi.spyOn(tauriCommands, "listFeedArticleSummaries");

    const { result } = renderHook(({ accountId }: HookProps) => useFeedArticleSummaries(accountId), {
      initialProps: { accountId: "   " },
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(listFeedArticleSummariesSpy).not.toHaveBeenCalled();
  });

  it("trims a valid account id before building the query and command call", async () => {
    const listFeedArticleSummariesSpy = vi
      .spyOn(tauriCommands, "listFeedArticleSummaries")
      .mockResolvedValue(
        Result.succeed([{ feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 }]),
      );

    const { result, rerender } = renderHook(({ accountId }: HookProps) => useFeedArticleSummaries(accountId), {
      initialProps: { accountId: " acc-1 " },
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 },
      ]);
    });

    rerender({ accountId: "acc-1" });

    expect(listFeedArticleSummariesSpy).toHaveBeenCalledTimes(1);
    expect(listFeedArticleSummariesSpy).toHaveBeenCalledWith("acc-1");
  });

  it("does not keep the previous account summaries while the next account query is pending", async () => {
    const initialProps: HookProps = { accountId: "acc-1" };
    let resolveSecondAccount!: (value: Awaited<ReturnType<typeof tauriCommands.listFeedArticleSummaries>>) => void;
    const listFeedArticleSummariesSpy = vi
      .spyOn(tauriCommands, "listFeedArticleSummaries")
      .mockResolvedValueOnce(
        Result.succeed([{ feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 }]),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Awaited<ReturnType<typeof tauriCommands.listFeedArticleSummaries>>>((resolve) => {
            resolveSecondAccount = resolve;
          }),
      );

    const { result, rerender } = renderHook(({ accountId }: HookProps) => useFeedArticleSummaries(accountId), {
      initialProps,
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { feed_id: "feed-1", latest_article_at: "2026-04-01T00:00:00Z", starred_count: 2 },
      ]);
    });

    rerender({ accountId: "acc-2" });

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe("fetching");

    resolveSecondAccount(Result.succeed([{ feed_id: "feed-2", latest_article_at: null, starred_count: 0 }]));

    await waitFor(() => {
      expect(result.current.data).toEqual([{ feed_id: "feed-2", latest_article_at: null, starred_count: 0 }]);
    });
    expect(listFeedArticleSummariesSpy).toHaveBeenCalledWith("acc-1");
    expect(listFeedArticleSummariesSpy).toHaveBeenCalledWith("acc-2");
  });
});
