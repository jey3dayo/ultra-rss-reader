import { renderHook } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { useCancelReaderQueriesOnAccountSwitch } from "@/hooks/use-cancel-reader-queries-on-account-switch";
import { queryKeys } from "@/lib/query/query-invalidation";

describe("useCancelReaderQueriesOnAccountSwitch", () => {
  it("cancels stale reader query roots after switching accounts", () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ accountId }: { accountId: string | null }) => useCancelReaderQueriesOnAccountSwitch(accountId),
      {
        initialProps: { accountId: "acc-1" },
        wrapper,
      },
    );

    expect(cancelQueriesSpy).not.toHaveBeenCalled();

    rerender({ accountId: "acc-2" });

    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.accountArticles.root });
    expect(cancelQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.search.root });
  });

  it("does not cancel queries when rerendering the same account", () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ accountId }: { accountId: string | null }) => useCancelReaderQueriesOnAccountSwitch(accountId),
      {
        initialProps: { accountId: "acc-1" },
        wrapper,
      },
    );

    rerender({ accountId: "acc-1" });

    expect(cancelQueriesSpy).not.toHaveBeenCalled();
  });
});
