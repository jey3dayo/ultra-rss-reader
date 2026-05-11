import { renderHook } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES,
  ACCOUNT_SWITCH_QUERY_ROOTS,
  ACCOUNT_SWITCH_RENDER_BUDGET_MS,
  accountSwitchBudgetSampleExceedsBudget,
  createAccountSwitchBudgetSample,
  useCancelReaderQueriesOnAccountSwitch,
} from "@/hooks/use-cancel-reader-queries-on-account-switch";
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

  it("keeps large account switches bounded to stable query roots", () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const cancelQueriesSpy = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const largeAccountArticleCount = 2_000;

    for (let index = 0; index < largeAccountArticleCount; index += 1) {
      queryClient.setQueryData(["article", "acc-1", index], {
        id: `article-${index}`,
        accountId: "acc-1",
      });
    }
    const queryCountBeforeSwitch = queryClient.getQueryCache().getAll().length;

    const { rerender } = renderHook(
      ({ accountId }: { accountId: string | null }) => useCancelReaderQueriesOnAccountSwitch(accountId),
      {
        initialProps: { accountId: "acc-1" },
        wrapper,
      },
    );

    rerender({ accountId: "acc-2" });

    expect(cancelQueriesSpy).toHaveBeenCalledTimes(ACCOUNT_SWITCH_QUERY_ROOTS.length);
    expect(cancelQueriesSpy.mock.calls.map(([filters]) => filters)).toEqual(
      ACCOUNT_SWITCH_QUERY_ROOTS.map((queryKey) => ({ queryKey })),
    );
    expect(queryClient.getQueryCache().getAll()).toHaveLength(queryCountBeforeSwitch);
  });

  it("keeps render duration and memory smoke budgets measurable for large account switches", () => {
    const passingSample = createAccountSwitchBudgetSample({
      previousAccountId: "acc-1",
      selectedAccountId: "acc-2",
      startedAtMs: 10,
      finishedAtMs: 10 + ACCOUNT_SWITCH_RENDER_BUDGET_MS,
      startedHeapBytes: 10_000,
      finishedHeapBytes: 10_000 + ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES,
    });
    const slowSample = createAccountSwitchBudgetSample({
      previousAccountId: "acc-1",
      selectedAccountId: "acc-2",
      startedAtMs: 10,
      finishedAtMs: 11 + ACCOUNT_SWITCH_RENDER_BUDGET_MS,
      startedHeapBytes: 10_000,
      finishedHeapBytes: 10_000,
    });
    const memoryPressureSample = createAccountSwitchBudgetSample({
      previousAccountId: "acc-1",
      selectedAccountId: "acc-2",
      startedAtMs: 10,
      finishedAtMs: 10,
      startedHeapBytes: 10_000,
      finishedHeapBytes: 10_001 + ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES,
    });

    expect(passingSample).toEqual({
      previousAccountId: "acc-1",
      selectedAccountId: "acc-2",
      renderDurationMs: ACCOUNT_SWITCH_RENDER_BUDGET_MS,
      memoryDeltaBytes: ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES,
    });
    expect(accountSwitchBudgetSampleExceedsBudget(passingSample)).toBe(false);
    expect(accountSwitchBudgetSampleExceedsBudget(slowSample)).toBe(true);
    expect(accountSwitchBudgetSampleExceedsBudget(memoryPressureSample)).toBe(true);
  });
});
