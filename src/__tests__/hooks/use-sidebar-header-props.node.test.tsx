import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSidebarHeaderProps } from "@/components/reader/hooks/sidebar/use-sidebar-header-props";
import i18n from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-invalidation";

setupBrowserTestDom();

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createHeaderParams(
  overrides: Partial<Parameters<typeof useSidebarHeaderProps>[0]> = {},
): Parameters<typeof useSidebarHeaderProps>[0] {
  return {
    t: i18n.getFixedT("en", "sidebar"),
    selectedAccountId: "acc-1",
    syncProgress: { active: false, kind: null },
    handleSync: vi.fn(),
    syncTooltipLabel: null,
    isSyncCoolingDown: false,
    isSyncDisabled: false,
    handleAddFeed: vi.fn(),
    ...overrides,
  };
}

describe("useSidebarHeaderProps", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps syncing after finished while the selected account feeds refetch is in flight", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.feeds.byAccount("acc-1"),
        queryFn: () => deferred.promise,
      });
    });

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("syncing");
    });

    deferred.resolve([]);
    await fetchPromise;
  });

  it("returns to idle when the selected account feeds refetch settles", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.feeds.byAccount("acc-1"),
        queryFn: () => deferred.promise,
      });
    });

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("syncing");
    });
    deferred.resolve([]);
    await fetchPromise;

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("idle");
    });
  });

  it("returns to idle when the selected account feeds refetch fails", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.feeds.byAccount("acc-1"),
        queryFn: () => deferred.promise,
      });
    });
    await waitFor(() => {
      expect(result.current.syncState.status).toBe("syncing");
    });

    const fetchError = new Error("feed refetch failed");
    deferred.reject(fetchError);
    await fetchPromise?.catch(() => undefined);

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("idle");
    });
  });

  it("returns to idle when the selected account feeds refetch is cancelled", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.feeds.byAccount("acc-1"),
        queryFn: ({ signal }) =>
          new Promise<readonly unknown[]>((resolve, reject) => {
            const abort = () => reject(new Error("feed refetch cancelled"));
            signal.addEventListener("abort", abort, { once: true });
            deferred.promise.then(resolve, reject);
          }),
      });
    });
    void fetchPromise?.catch(() => undefined);

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("syncing");
    });

    await act(async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.byAccount("acc-1"), exact: true });
    });

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("idle");
    });
  });

  it("does not spin while an unrelated query is fetching", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.accounts.root,
        queryFn: () => deferred.promise,
      });
    });

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("idle");
    });
    deferred.resolve([]);
    await fetchPromise;
  });

  it("does not spin while another account's feeds are fetching", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const deferred = createDeferred<readonly unknown[]>();
    const { result } = renderHook(() => useSidebarHeaderProps(createHeaderParams()), { wrapper });

    let fetchPromise: Promise<readonly unknown[]> | undefined;
    act(() => {
      fetchPromise = queryClient.fetchQuery({
        queryKey: queryKeys.feeds.byAccount("acc-2"),
        queryFn: () => deferred.promise,
      });
    });

    await waitFor(() => {
      expect(result.current.syncState.status).toBe("idle");
    });
    deferred.resolve([]);
    await fetchPromise;
  });
});
