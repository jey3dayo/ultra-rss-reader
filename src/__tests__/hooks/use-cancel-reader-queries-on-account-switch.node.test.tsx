import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountStarredCount } from "@/hooks/use-articles";
import {
  ACCOUNT_SWITCH_MEMORY_BUDGET_BYTES,
  ACCOUNT_SWITCH_RENDER_BUDGET_MS,
  accountSwitchBudgetSampleExceedsBudget,
  createAccountSwitchBudgetSample,
  useCancelReaderQueriesOnAccountSwitch,
} from "@/hooks/use-cancel-reader-queries-on-account-switch";
import { useFeeds } from "@/hooks/use-feeds";
import { queryKeys } from "@/lib/query/query-invalidation";

setupBrowserTestDom();

afterEach(() => {
  cleanup();
});

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

    // A single predicate-based call replaces the old per-root loop so that the
    // decision of "cancel or not" can look at the whole query key (root AND
    // account id) instead of matching on root alone. See
    // isAccountSwitchCancelTarget in the hook module for why root-only
    // matching is unsafe.
    expect(cancelQueriesSpy).toHaveBeenCalledTimes(1);
    const [callArgs] = cancelQueriesSpy.mock.calls[0] ?? [];
    expect(typeof callArgs?.predicate).toBe("function");
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

  it("keeps large account switches bounded to a single cancelQueries call", () => {
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

    expect(cancelQueriesSpy).toHaveBeenCalledTimes(1);
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

describe("useCancelReaderQueriesOnAccountSwitch account switch ordering (regression)", () => {
  // Reproduces the production bug: app-layout.tsx renders Sidebar before
  // ArticleList, both call useCancelReaderQueriesOnAccountSwitch, and React
  // runs a sibling's effects only after the earlier sibling's effects have
  // all run. SidebarLikeConsumer below intentionally keeps that call order
  // (cancel hook, then the query hooks it guards) to match
  // use-sidebar-runtime.ts, and ArticleListLikeConsumer intentionally has NO
  // query subscriptions of its own -- only the cancel hook -- to match
  // use-article-list-runtime.ts's shape for the sidebar-only query roots
  // (accountStarredCount, tagArticleCounts, feedArticleSummaries) that have no
  // independent ArticleList subscriber to accidentally refetch them.
  function SidebarLikeConsumer({ accountId }: { accountId: string | null }) {
    useCancelReaderQueriesOnAccountSwitch(accountId);
    useFeeds(accountId);
    useAccountStarredCount(accountId);
    return null;
  }

  function ArticleListLikeConsumer({ accountId }: { accountId: string | null }) {
    useCancelReaderQueriesOnAccountSwitch(accountId);
    return null;
  }

  function Harness({ accountId }: { accountId: string | null }) {
    return (
      <>
        <SidebarLikeConsumer accountId={accountId} />
        <ArticleListLikeConsumer accountId={accountId} />
      </>
    );
  }

  beforeEach(() => {
    setupTauriMocks();
  });

  afterEach(() => {
    teardownTauriMocks();
  });

  it("keeps the incoming account's sidebar starred count query fetching after an account switch", async () => {
    const { queryClient, wrapper: Wrapper } = createQueryWrapper();

    const { rerender } = render(<Harness accountId="acc-1" />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("acc-1"))?.status).toBe("success");
    });

    rerender(<Harness accountId="acc-2" />);

    await waitFor(() => {
      const state = queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("acc-2"));
      expect(state?.status).toBe("success");
      expect(state?.fetchStatus).toBe("idle");
      expect(state?.data).toBeDefined();
    });
  });

  it("keeps the incoming account's feeds query fetching after an account switch, without relying on ArticleList's independent feeds subscription", async () => {
    const { queryClient, wrapper: Wrapper } = createQueryWrapper();

    const { rerender } = render(<Harness accountId="acc-1" />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKeys.feeds.byAccount("acc-1"))?.status).toBe("success");
    });

    rerender(<Harness accountId="acc-2" />);

    await waitFor(() => {
      const state = queryClient.getQueryState(queryKeys.feeds.byAccount("acc-2"));
      expect(state?.status).toBe("success");
      expect(state?.fetchStatus).toBe("idle");
      expect(state?.data).toBeDefined();
    });
  });

  // Complements the two tests above: those only prove the incoming account
  // survives. This one proves the hook still does its actual job -- a
  // predicate of `() => false` (i.e. this hook doing nothing) would make the
  // two tests above pass too, since an account switch that cancels nothing
  // trivially "keeps the incoming account's query fetching". Pin both halves
  // of the invariant (outgoing account cancelled, incoming account alive) in
  // one assertion so a no-op predicate cannot slip through.
  it("cancels the outgoing account's in-flight query while keeping the incoming account's query alive", async () => {
    const releaseAccountAFetchRef: { current: (() => void) | null } = { current: null };
    const accountAFetchGate = new Promise<void>((resolve) => {
      releaseAccountAFetchRef.current = resolve;
    });

    setupTauriMocks((cmd, args) => {
      if (cmd === "count_account_starred_articles" && args.accountId === "acc-1") {
        // Hangs until the test explicitly releases it, so account A's fetch is
        // still in flight at the moment the account switch happens below.
        return accountAFetchGate.then(() => 3);
      }
      return undefined;
    });

    const { queryClient, wrapper: Wrapper } = createQueryWrapper();

    const { rerender } = render(<Harness accountId="acc-1" />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("acc-1"))?.fetchStatus).toBe("fetching");
    });

    rerender(<Harness accountId="acc-2" />);

    await waitFor(() => {
      const outgoing = queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("acc-1"));
      const incoming = queryClient.getQueryState(queryKeys.accountStarredCount.byAccount("acc-2"));

      // Outgoing account (A): cancelQueries must actually stop the in-flight
      // fetch, not merely leave the incoming account's query alone.
      expect(outgoing?.fetchStatus).toBe("idle");
      // Incoming account (B): unaffected by the cancellation targeting A.
      expect(incoming?.status).toBe("success");
      expect(incoming?.fetchStatus).toBe("idle");
      expect(incoming?.data).toBeDefined();
    });

    releaseAccountAFetchRef.current?.();
  });
});
