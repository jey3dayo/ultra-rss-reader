import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as readStateDiagnostics from "@/components/reader/hooks/article/read-state-diagnostics";
import {
  clearManualUnreadAutoMarkSuppression,
  clearManualUnreadAutoMarkSuppressionsForTests,
  suppressAutoMarkAfterManualUnread,
  useArticleAutoMark,
} from "@/components/reader/hooks/article/use-article-auto-mark";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

type UseArticleAutoMarkParams = Parameters<typeof useArticleAutoMark>[0];
type AutoMarkMutate = UseArticleAutoMarkParams["setRead"]["mutate"];
type AutoMarkOnErrorContext = Parameters<NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onError"]>>[3];

function createMutationContext(): AutoMarkOnErrorContext {
  return {
    client: new QueryClient(),
    meta: undefined,
  };
}

function createParams(overrides: Partial<UseArticleAutoMarkParams> = {}): UseArticleAutoMarkParams {
  return {
    articleId: "art-1",
    isRead: false,
    articleEngagement: "reading",
    afterReading: "after_1s",
    viewMode: "all",
    retainArticle: vi.fn(),
    addRecentlyRead: vi.fn(),
    setRead: {
      mutate: vi.fn(),
    },
    showToast: vi.fn(),
    ...overrides,
  };
}

describe("useArticleAutoMark", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({
      selectedAccountId: "account-1",
      retainedArticleIds: new Set(),
      recentlyReadIds: new Set(),
    });
  });

  afterEach(async () => {
    cleanup();
    clearManualUnreadAutoMarkSuppressionsForTests();
    vi.useRealTimers();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    vi.unstubAllGlobals();
  });

  it("keeps a delayed mark scheduled while the mutation result wrapper changes", () => {
    const mutate = vi.fn();
    const retainArticle = vi.fn();
    const addRecentlyRead = vi.fn();
    const showToast = vi.fn();
    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          afterReading: "after_0_3s",
          retainArticle,
          addRecentlyRead,
          setRead: { mutate },
          showToast,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(
      createParams({
        afterReading: "after_0_3s",
        retainArticle,
        addRecentlyRead,
        setRead: { mutate },
        showToast,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(
      createParams({
        afterReading: "after_0_3s",
        retainArticle,
        addRecentlyRead,
        setRead: { mutate },
        showToast,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("keeps a delayed mark scheduled with a real React Query mutation", async () => {
    const mutationFn = vi.fn(async (_variables: { id: string; read: boolean }) => undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          gcTime: Infinity,
          retry: false,
        },
      },
    });
    const params = createParams({ afterReading: "after_0_3s" });
    const { rerender } = renderHook(
      () => {
        const setRead = useMutation<unknown, Error, { id: string; read: boolean }>({ mutationFn });
        useArticleAutoMark({ ...params, setRead });
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mutationFn).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it.each([
    ["after_0_3s", 300],
    ["after_0_5s", 500],
    ["after_1s", 1000],
  ] as const)("fires a delayed mark after %s", (afterReading, delayMs) => {
    const mutate = vi.fn();
    const retainArticle = vi.fn();
    const addRecentlyRead = vi.fn();
    const showToast = vi.fn();
    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          afterReading,
          retainArticle,
          addRecentlyRead,
          setRead: { mutate },
          showToast,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(delayMs - 1);
    });
    expect(mutate).not.toHaveBeenCalled();

    rerender(
      createParams({
        afterReading,
        retainArticle,
        addRecentlyRead,
        setRead: { mutate },
        showToast,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate an immediate mark under StrictMode", () => {
    const mutate = vi.fn();
    const params = createParams({
      afterReading: "immediately",
      setRead: { mutate },
    });

    renderHook(() => useArticleAutoMark(params), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("cancels a delayed mark when the article changes", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    const retainArticle = vi.fn();

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          viewMode: "unread",
          retainArticle,
          setRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(999);
    });

    rerender(
      createParams({
        articleId: "art-2",
        viewMode: "unread",
        retainArticle,
        setRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-2", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(retainArticle).toHaveBeenCalledWith("art-2");
  });

  it("ignores a stale delayed timer callback after a newer timer is scheduled", () => {
    const scheduledCallbacks: Array<() => void> = [];
    const timeoutHandles: Array<ReturnType<typeof setTimeout>> = [setTimeout(() => {}, 0), setTimeout(() => {}, 0)];
    vi.stubGlobal(
      "setTimeout",
      vi.fn((handler: TimerHandler) => {
        if (typeof handler === "function") {
          scheduledCallbacks.push(() => {
            handler();
          });
        }

        const timeoutHandle = timeoutHandles.shift();
        if (timeoutHandle === undefined) {
          throw new Error("unexpected setTimeout call");
        }
        return timeoutHandle;
      }),
    );
    vi.stubGlobal("clearTimeout", vi.fn());
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          setRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-2",
        setRead,
      }),
    );

    act(() => {
      scheduledCallbacks[0]?.();
    });

    expect(setRead.mutate).not.toHaveBeenCalled();

    act(() => {
      scheduledCallbacks[1]?.();
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-2", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("cancels a delayed mark when view mode changes before the timer fires", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    const retainArticle = vi.fn();

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          viewMode: "unread",
          retainArticle,
          setRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(999);
    });

    rerender(
      createParams({
        articleId: "art-1",
        viewMode: "all",
        retainArticle,
        setRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(retainArticle).not.toHaveBeenCalled();
  });

  it("cancels a delayed mark when the selected account changes before the timer fires", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    const retainArticle = vi.fn();

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          viewMode: "unread",
          retainArticle,
          setRead,
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });
    act(() => {
      useUiStore.setState({ selectedAccountId: "account-2" });
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(retainArticle).toHaveBeenCalledWith("art-1");
  });

  it("cancels a delayed mark when unmounted", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    const retainArticle = vi.fn();
    const showToast = vi.fn();

    const { unmount } = renderHook(() => {
      useArticleAutoMark(
        createParams({
          viewMode: "unread",
          retainArticle,
          setRead,
          showToast,
        }),
      );
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not mark the same article twice after a delayed mark fires", () => {
    const firstSetRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    const secondSetRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          setRead: firstSetRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    rerender(
      createParams({
        articleId: "art-1",
        setRead: secondSetRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(firstSetRead.mutate).toHaveBeenCalledTimes(1);
    expect(secondSetRead.mutate).not.toHaveBeenCalled();
  });

  it("does not re-mark after a successful auto mark and a stale unread projection", () => {
    let onSuccess: NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onSuccess"]> | null = null;
    const retainArticle = vi.fn();
    const addRecentlyRead = vi.fn();
    const showToast = vi.fn();
    const mutate: AutoMarkMutate = (_variables, options) => {
      onSuccess = options?.onSuccess ?? null;
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          afterReading: "immediately",
          retainArticle,
          addRecentlyRead,
          setRead,
          showToast,
        }),
      },
    );

    act(() => {
      onSuccess?.(undefined, { id: "art-1", read: true }, undefined, createMutationContext());
    });
    rerender(
      createParams({
        afterReading: "immediately",
        isRead: true,
        retainArticle,
        addRecentlyRead,
        setRead,
        showToast,
      }),
    );
    rerender(
      createParams({
        afterReading: "immediately",
        isRead: false,
        retainArticle,
        addRecentlyRead,
        setRead,
        showToast,
      }),
    );

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
  });

  it("allows the same article to auto-mark again after it was read and returned to unread", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          afterReading: "immediately",
          isRead: false,
          setRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "immediately",
        isRead: true,
        setRead,
      }),
    );
    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "immediately",
        isRead: false,
        setRead,
      }),
    );

    expect(setRead.mutate).toHaveBeenCalledTimes(2);
  });

  it("does not auto-mark an article suppressed after a manual unread action", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    suppressAutoMarkAfterManualUnread("account-1", "art-1");

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          articleId: "art-1",
          afterReading: "after_1s",
          setRead,
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
  });

  it("keeps manual unread suppression through a transient stale read render", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    suppressAutoMarkAfterManualUnread("account-1", "art-1");

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          afterReading: "after_1s",
          isRead: true,
          setRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "after_1s",
        isRead: false,
        setRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
  });

  it("clears manual unread suppression after selecting another article", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    suppressAutoMarkAfterManualUnread("account-1", "art-1");

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          afterReading: "after_1s",
          setRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(setRead.mutate).not.toHaveBeenCalled();

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "after_1s",
        setRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-2", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );

    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "after_1s",
        setRead,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(2);
    expect(setRead.mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("auto-marks again after manual read clears a previous manual unread suppression", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    suppressAutoMarkAfterManualUnread("account-1", "art-1");
    clearManualUnreadAutoMarkSuppression("account-1", "art-1");

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          articleId: "art-1",
          afterReading: "after_1s",
          setRead,
        }),
      );
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(setRead.mutate).toHaveBeenCalledTimes(1);
    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("immediately marks unread articles and records success only after mutation success", () => {
    const addRecentlyRead = vi.fn();
    const mutate: AutoMarkMutate = (variables, options) => {
      options?.onSuccess?.(undefined, variables, undefined, createMutationContext());
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          afterReading: "immediately",
          setRead,
          addRecentlyRead,
        }),
      );
    });

    expect(setRead.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(addRecentlyRead).toHaveBeenCalledWith("art-1");
  });

  it("allows the same article to retry after auto mark mutation fails", () => {
    const showToast = vi.fn();
    const mutate: AutoMarkMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark read"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          afterReading: "immediately",
          setRead,
          showToast,
        }),
      },
    );

    rerender(
      createParams({
        afterReading: "immediately",
        setRead,
        showToast,
      }),
    );

    expect(setRead.mutate).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("rolls back auto-retained unread articles when auto mark mutation fails", () => {
    const showToast = vi.fn();
    const mutate: AutoMarkMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark read"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          afterReading: "immediately",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
        }),
      );
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
    expect(showToast).toHaveBeenCalledWith("Failed to mark read");
  });

  it("keeps pre-existing retained unread articles when auto mark mutation fails", () => {
    useUiStore.getState().retainArticle("art-1");
    const mutate: AutoMarkMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark read"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          afterReading: "immediately",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
        }),
      );
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("does not block the next article after a failed auto mark mutation", () => {
    const mutate: AutoMarkMutate = (variables, options) => {
      options?.onError?.(new Error(`Failed ${variables.id}`), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          afterReading: "immediately",
          setRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "immediately",
        setRead,
      }),
    );

    expect(setRead.mutate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(setRead.mutate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "art-2", read: true }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("ignores rollback and toast when a stale delayed mutation fails after the article changes", () => {
    const showToast = vi.fn();
    const addRecentlyRead = vi.fn();
    const mutationCallbacks = new Map<string, NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onError"]>>();
    const mutate: AutoMarkMutate = (variables, options) => {
      if (options?.onError) {
        mutationCallbacks.set(variables.id, options.onError);
      }
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
          addRecentlyRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "immediately",
        viewMode: "unread",
        retainArticle: useUiStore.getState().retainArticle,
        setRead,
        showToast,
        addRecentlyRead,
      }),
    );

    act(() => {
      mutationCallbacks.get("art-1")?.(
        new Error("Failed stale article"),
        { id: "art-1", read: true },
        undefined,
        createMutationContext(),
      );
    });

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "immediately",
        viewMode: "unread",
        retainArticle: useUiStore.getState().retainArticle,
        setRead,
        showToast,
        addRecentlyRead,
      }),
    );

    expect(setRead.mutate).toHaveBeenCalledTimes(2);
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1", "art-2"]));
    expect(addRecentlyRead).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("ignores rollback and toast when a stale delayed mutation fails after view mode changes", () => {
    const showToast = vi.fn();
    let onError: NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onError"]> | null = null;
    const mutate: AutoMarkMutate = (_variables, options) => {
      onError = options?.onError ?? null;
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(
      createParams({
        articleId: "art-1",
        viewMode: "all",
        retainArticle: useUiStore.getState().retainArticle,
        setRead,
        showToast,
      }),
    );

    act(() => {
      onError?.(new Error("Failed stale view"), { id: "art-1", read: true }, undefined, createMutationContext());
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("ignores stale mutation success after view mode changes", () => {
    const addRecentlyRead = vi.fn();
    let onSuccess: NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onSuccess"]> | null = null;
    const mutate: AutoMarkMutate = (_variables, options) => {
      onSuccess = options?.onSuccess ?? null;
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          addRecentlyRead,
        }),
      },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(
      createParams({
        articleId: "art-1",
        viewMode: "all",
        retainArticle: useUiStore.getState().retainArticle,
        setRead,
        addRecentlyRead,
      }),
    );

    act(() => {
      onSuccess?.(undefined, { id: "art-1", read: true }, undefined, createMutationContext());
    });

    expect(addRecentlyRead).not.toHaveBeenCalled();
  });

  it("ignores stale mutation success after the selected account changes", () => {
    const addRecentlyRead = vi.fn();
    const mutationCallbacks: Array<NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onSuccess"]>> = [];
    const mutate: AutoMarkMutate = (_variables, options) => {
      if (options?.onSuccess) {
        mutationCallbacks.push(options.onSuccess);
      }
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          articleId: "art-1",
          afterReading: "immediately",
          setRead,
          addRecentlyRead,
        }),
      );
    });

    act(() => {
      useUiStore.setState({ selectedAccountId: "account-2" });
    });
    act(() => {
      mutationCallbacks[0]?.(undefined, { id: "art-1", read: true }, undefined, createMutationContext());
    });

    expect(addRecentlyRead).not.toHaveBeenCalled();
  });

  it("ignores stale mutation error after the selected account changes", () => {
    const showToast = vi.fn();
    const mutationCallbacks: Array<NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onError"]>> = [];
    const mutate: AutoMarkMutate = (_variables, options) => {
      if (options?.onError) {
        mutationCallbacks.push(options.onError);
      }
    };
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          articleId: "art-1",
          afterReading: "immediately",
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
        }),
      );
    });

    act(() => {
      useUiStore.setState({ selectedAccountId: "account-2" });
    });
    act(() => {
      mutationCallbacks[0]?.(
        new Error("Failed stale account"),
        { id: "art-1", read: true },
        undefined,
        createMutationContext(),
      );
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("ignores stale mutation success after the mutation owner changes", () => {
    const addRecentlyRead = vi.fn();
    const mutationCallbacks = new Map<string, NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onSuccess"]>>();
    const firstSetRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn((variables, options) => {
        if (options?.onSuccess) {
          mutationCallbacks.set(`first:${variables.id}`, options.onSuccess);
        }
      }),
    };
    const secondSetRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn((variables, options) => {
        if (options?.onSuccess) {
          mutationCallbacks.set(`second:${variables.id}`, options.onSuccess);
        }
      }),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          afterReading: "immediately",
          setRead: firstSetRead,
          addRecentlyRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "immediately",
        setRead: secondSetRead,
        addRecentlyRead,
      }),
    );

    act(() => {
      mutationCallbacks.get("first:art-1")?.(
        undefined,
        { id: "art-1", read: true },
        undefined,
        createMutationContext(),
      );
      mutationCallbacks.get("second:art-2")?.(
        undefined,
        { id: "art-2", read: true },
        undefined,
        createMutationContext(),
      );
    });

    expect(addRecentlyRead).toHaveBeenCalledTimes(1);
    expect(addRecentlyRead).toHaveBeenCalledWith("art-2");
  });

  it("does not let a stale mutation error re-arm the current article after switching away and back", () => {
    const mutationCallbacks = new Map<
      string,
      Array<NonNullable<NonNullable<Parameters<AutoMarkMutate>[1]>["onError"]>>
    >();
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn((variables, options) => {
        if (options?.onError) {
          mutationCallbacks.set(variables.id, [...(mutationCallbacks.get(variables.id) ?? []), options.onError]);
        }
      }),
    };

    const { rerender } = renderHook(
      (props: UseArticleAutoMarkParams) => {
        useArticleAutoMark(props);
      },
      {
        initialProps: createParams({
          articleId: "art-1",
          afterReading: "immediately",
          setRead,
        }),
      },
    );

    rerender(
      createParams({
        articleId: "art-2",
        afterReading: "immediately",
        setRead,
      }),
    );
    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "immediately",
        setRead,
      }),
    );

    act(() => {
      mutationCallbacks.get("art-1")?.[0]?.(
        new Error("Failed stale article"),
        { id: "art-1", read: true },
        undefined,
        createMutationContext(),
      );
    });

    rerender(
      createParams({
        articleId: "art-1",
        afterReading: "immediately",
        setRead,
      }),
    );

    expect(setRead.mutate).toHaveBeenCalledTimes(3);
    expect(setRead.mutate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(setRead.mutate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: "art-2", read: true }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(setRead.mutate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ id: "art-1", read: true }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not schedule a delayed mark when timers are unavailable", () => {
    const setRead: UseArticleAutoMarkParams["setRead"] = {
      mutate: vi.fn(),
    };
    vi.useRealTimers();
    vi.stubGlobal("setTimeout", undefined);

    renderHook(() => {
      useArticleAutoMark(
        createParams({
          afterReading: "after_1s",
          setRead,
        }),
      );
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
  });
});

describe("useArticleAutoMark read-state diagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({
      selectedAccountId: "account-1",
      retainedArticleIds: new Set(),
      recentlyReadIds: new Set(),
    });
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    cleanup();
    clearManualUnreadAutoMarkSuppressionsForTests();
    vi.useRealTimers();
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    vi.unstubAllGlobals();
  });

  it("records scheduled then dispatched for a delayed auto-mark, with a stale-owner check available", () => {
    const scheduledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkScheduled");
    const dispatchedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkDispatched");
    const mutate = vi.fn();

    renderHook(() =>
      useArticleAutoMark(
        createParams({
          afterReading: "after_0_3s",
          setRead: { mutate },
        }),
      ),
    );

    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    const [requestId, generation, delayMs] = scheduledSpy.mock.calls[0] as [string, number, number];
    expect(delayMs).toBe(300);
    expect(typeof requestId).toBe("string");
    expect(typeof generation).toBe("number");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(dispatchedSpy).toHaveBeenCalledTimes(1);
    expect(dispatchedSpy).toHaveBeenCalledWith(requestId, generation, expect.any(Number));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        diagnostics: expect.objectContaining({ requestId, generation }),
      }),
      expect.anything(),
    );
  });

  it("records dispatched with zero drift for an immediate auto-mark", () => {
    const dispatchedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkDispatched");
    const mutate = vi.fn();

    renderHook(() =>
      useArticleAutoMark(
        createParams({
          afterReading: "immediately",
          setRead: { mutate },
        }),
      ),
    );

    expect(dispatchedSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 0);
  });

  it("records skipped(already_read) when the article is already read", () => {
    const skippedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkSkipped");

    renderHook(() =>
      useArticleAutoMark(
        createParams({
          isRead: true,
        }),
      ),
    );

    expect(skippedSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "already_read");
  });

  it("records skipped(not_reading) when engagement is not reading", () => {
    const skippedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkSkipped");

    renderHook(() =>
      useArticleAutoMark(
        createParams({
          articleEngagement: "preview",
        }),
      ),
    );

    expect(skippedSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "not_reading");
  });

  it("records skipped(preference_never) when after-reading preference is never", () => {
    const skippedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkSkipped");

    renderHook(() =>
      useArticleAutoMark(
        createParams({
          afterReading: "never",
        }),
      ),
    );

    expect(skippedSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "preference_never");
  });

  it("records skipped(manual_unread_suppressed) after a manual unread on the same owner", () => {
    suppressAutoMarkAfterManualUnread("account-1", "art-1");
    const skippedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkSkipped");

    renderHook(() => useArticleAutoMark(createParams()));

    expect(skippedSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "manual_unread_suppressed");
  });

  it("records cancelled(effect_cleanup) when a scheduled mark is torn down by an article change", () => {
    const cancelledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkCancelled");
    const setRead: UseArticleAutoMarkParams["setRead"] = { mutate: vi.fn() };

    const { rerender } = renderHook((props: UseArticleAutoMarkParams) => useArticleAutoMark(props), {
      initialProps: createParams({ articleId: "art-1", viewMode: "unread", setRead }),
    });

    rerender(createParams({ articleId: "art-2", viewMode: "unread", setRead }));

    expect(cancelledSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "effect_cleanup");
  });

  it("records cancelled(effect_cleanup) on unmount while a mark is still pending", () => {
    const cancelledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkCancelled");
    const setRead: UseArticleAutoMarkParams["setRead"] = { mutate: vi.fn() };

    const { unmount } = renderHook(() => useArticleAutoMark(createParams({ setRead })));

    unmount();

    expect(cancelledSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), "effect_cleanup");
  });

  it("uses a distinct generation for each StrictMode re-invocation and never re-schedules the stale one", () => {
    const scheduledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkScheduled");
    const mutate = vi.fn();

    renderHook(() => useArticleAutoMark(createParams({ afterReading: "after_0_3s", setRead: { mutate } })), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    const generations = scheduledSpy.mock.calls.map((call) => call[1]);
    expect(new Set(generations).size).toBe(generations.length);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the surviving (latest) generation's timer actually dispatches; StrictMode's discarded
    // first effect instance must not also fire a mutate call for its stale timer.
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
