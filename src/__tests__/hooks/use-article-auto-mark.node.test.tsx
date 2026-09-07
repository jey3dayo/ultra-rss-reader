import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import "@testing-library/react/dont-cleanup-after-each";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import type { ReactNode } from "react";
import { StrictMode, Suspense, startTransition, use, useEffect, useLayoutEffect, useState } from "react";
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

// A promise that never settles, so a render that reads it always suspends. Created once at module
// scope: a promise created during render would be a different, uncached promise on every attempt.
const neverCommittedArticle = new Promise<void>(() => {});

function SuspendUnlessDisplayedArticle({ articleId }: { articleId: string }) {
  if (articleId !== "art-1") {
    // `use` may be called conditionally, unlike the other hooks.
    use(neverCommittedArticle);
  }
  return null;
}

/** Params whose callback identities are stable across rerenders, so an unrelated rerender does not
 * churn the scheduling effect's dependencies and silently restart the delay. */
function createStableAutoMarkParams() {
  const mutate = vi.fn();
  const retainArticle = vi.fn();
  const addRecentlyRead = vi.fn();
  const showToast = vi.fn();
  const setRead: UseArticleAutoMarkParams["setRead"] = { mutate };

  return {
    mutate,
    retainArticle,
    params(overrides: Partial<UseArticleAutoMarkParams> = {}): UseArticleAutoMarkParams {
      return {
        articleId: "art-1",
        isRead: false,
        articleEngagement: "reading",
        afterReading: "after_0_3s",
        viewMode: "all",
        retainArticle,
        addRecentlyRead,
        setRead,
        showToast,
        ...overrides,
      };
    },
  };
}

/** Replaces setTimeout so delayed auto-mark callbacks can be held and fired at a chosen point in
 * the React lifecycle instead of by the timer queue. Only the auto-mark delay is captured; the
 * diagnostics module's own throttle timers keep working through the same stub. */
function captureDelayedAutoMarkCallbacks(delayMs: number): Array<() => void> {
  const scheduledCallbacks: Array<() => void> = [];
  let nextTimeoutHandle = 0;

  vi.stubGlobal(
    "setTimeout",
    vi.fn((handler: TimerHandler, timeoutMs?: number) => {
      if (typeof handler === "function" && timeoutMs === delayMs) {
        scheduledCallbacks.push(() => {
          handler();
        });
      }
      nextTimeoutHandle += 1;
      return nextTimeoutHandle;
    }),
  );
  vi.stubGlobal("clearTimeout", vi.fn());

  return scheduledCallbacks;
}

/** Fires a held auto-mark callback from the layout phase of a later commit, i.e. after that commit
 * is committed but before its passive effects (and therefore this hook's passive cleanup) are
 * flushed. `fireStaleTimerOnCommit` is a plain mutable box, not a React ref: it is test wiring, and
 * it is only ever read from inside an effect. */
function CommitBoundaryProbeHarness({
  autoMarkParams,
  label,
  lifecycleOrder,
  fireStaleTimerOnCommit,
}: {
  autoMarkParams: UseArticleAutoMarkParams;
  label: string;
  lifecycleOrder: string[];
  fireStaleTimerOnCommit: { fire: (() => void) | null };
}) {
  useArticleAutoMark(autoMarkParams);
  // Declared after the hook, so this runs in the same commit, after the hook's own layout effect
  // and before any passive effect of that commit is flushed.
  useLayoutEffect(() => {
    lifecycleOrder.push(`layout:${label}`);
    const fireStaleTimer = fireStaleTimerOnCommit.fire;
    if (fireStaleTimer !== null) {
      lifecycleOrder.push("stale-timer");
      fireStaleTimer();
    }
  });
  useEffect(() => {
    lifecycleOrder.push(`passive:${label}`);
  });
  return null;
}

describe("useArticleAutoMark commit boundary", () => {
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

  // Deterministic injection of the commit-before-passive ordering, not a reproduction of how often
  // the natural race happens: the previous article's timer callback is fired from a layout-phase
  // probe in the commit that replaced it, so it lands after the newer article is committed but
  // before that commit's passive effects (and therefore this hook's passive cleanup) are flushed.
  it("does not dispatch a delayed mark whose committed target was replaced, even before the passive flush", () => {
    const scheduledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkScheduled");
    const dispatchedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkDispatched");
    const cancelledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkCancelled");
    const scheduledCallbacks = captureDelayedAutoMarkCallbacks(300);
    const { mutate, retainArticle, params } = createStableAutoMarkParams();
    const lifecycleOrder: string[] = [];
    const fireStaleTimerOnCommit: { fire: (() => void) | null } = { fire: null };

    const { rerender } = render(
      <CommitBoundaryProbeHarness
        autoMarkParams={params({ articleId: "art-1" })}
        fireStaleTimerOnCommit={fireStaleTimerOnCommit}
        label="art-1"
        lifecycleOrder={lifecycleOrder}
      />,
    );

    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    const staleRequestId = scheduledSpy.mock.calls[0]?.[0];
    expect(scheduledCallbacks).toHaveLength(1);

    fireStaleTimerOnCommit.fire = () => {
      scheduledCallbacks[0]?.();
    };
    rerender(
      <CommitBoundaryProbeHarness
        autoMarkParams={params({ articleId: "art-2" })}
        fireStaleTimerOnCommit={fireStaleTimerOnCommit}
        label="art-2"
        lifecycleOrder={lifecycleOrder}
      />,
    );
    fireStaleTimerOnCommit.fire = null;

    // The React ordering this guard depends on, asserted rather than assumed.
    expect(lifecycleOrder).toEqual(["layout:art-1", "passive:art-1", "layout:art-2", "stale-timer", "passive:art-2"]);
    expect(mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();
    expect(dispatchedSpy).not.toHaveBeenCalled();
    // The blocked attempt leaves the pending refs alone, so it still ends as exactly one
    // cancelled(effect_cleanup) recorded by the passive cleanup that follows.
    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    expect(cancelledSpy).toHaveBeenCalledWith(staleRequestId, expect.any(Number), "effect_cleanup");

    // The newly committed article is still marked by its own timer.
    act(() => {
      scheduledCallbacks[1]?.();
    });

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: "art-2", read: true }), expect.anything());
  });

  // Same deterministic commit-before-passive injection as the article-change case, for the input
  // that a single "eligible" boolean would have hidden: both after_0_3s and after_1s are enabled
  // delays, so only the concrete delay value in the committed target can invalidate the timer that
  // the previous preference armed.
  it("does not dispatch a delayed mark armed under a previously committed after-reading delay", () => {
    const scheduledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkScheduled");
    const dispatchedSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkDispatched");
    const cancelledSpy = vi.spyOn(readStateDiagnostics, "recordAutoMarkCancelled");
    const scheduledCallbacks = captureDelayedAutoMarkCallbacks(300);
    const { mutate, retainArticle, params } = createStableAutoMarkParams();
    const lifecycleOrder: string[] = [];
    const fireStaleTimerOnCommit: { fire: (() => void) | null } = { fire: null };

    const { rerender } = render(
      <CommitBoundaryProbeHarness
        autoMarkParams={params({ afterReading: "after_0_3s" })}
        fireStaleTimerOnCommit={fireStaleTimerOnCommit}
        label="after_0_3s"
        lifecycleOrder={lifecycleOrder}
      />,
    );

    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    expect(scheduledSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 300);
    const staleRequestId = scheduledSpy.mock.calls[0]?.[0];
    expect(scheduledCallbacks).toHaveLength(1);

    fireStaleTimerOnCommit.fire = () => {
      scheduledCallbacks[0]?.();
    };
    rerender(
      <CommitBoundaryProbeHarness
        autoMarkParams={params({ afterReading: "after_1s" })}
        fireStaleTimerOnCommit={fireStaleTimerOnCommit}
        label="after_1s"
        lifecycleOrder={lifecycleOrder}
      />,
    );
    fireStaleTimerOnCommit.fire = null;

    expect(lifecycleOrder).toEqual([
      "layout:after_0_3s",
      "passive:after_0_3s",
      "layout:after_1s",
      "stale-timer",
      "passive:after_1s",
    ]);
    expect(mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();
    expect(dispatchedSpy).not.toHaveBeenCalled();
    expect(cancelledSpy).toHaveBeenCalledTimes(1);
    expect(cancelledSpy).toHaveBeenCalledWith(staleRequestId, expect.any(Number), "effect_cleanup");

    // The newly committed delay is what actually arms the next attempt.
    expect(scheduledSpy).toHaveBeenCalledTimes(2);
    expect(scheduledSpy).toHaveBeenLastCalledWith(expect.any(String), expect.any(Number), 1000);
  });

  it("marks the displayed article when the next article is rendered but never committed", () => {
    const { mutate, params } = createStableAutoMarkParams();
    const renderedArticleIds: string[] = [];
    const committedArticleIds: string[] = [];
    let selectNextArticle: (() => void) | null = null;

    function UncommittedNextArticleHarness() {
      const [articleId, setArticleId] = useState("art-1");
      renderedArticleIds.push(articleId);
      useArticleAutoMark(params({ articleId }));
      useLayoutEffect(() => {
        committedArticleIds.push(articleId);
      }, [articleId]);
      useEffect(() => {
        selectNextArticle = () => {
          startTransition(() => {
            setArticleId("art-2");
          });
        };
      }, []);

      return (
        <Suspense fallback={null}>
          <SuspendUnlessDisplayedArticle articleId={articleId} />
        </Suspense>
      );
    }

    render(<UncommittedNextArticleHarness />);

    act(() => {
      selectNextArticle?.();
    });

    // Premise of this test: art-2 was rendered, but suspended in a transition and never committed.
    expect(renderedArticleIds).toContain("art-2");
    expect(committedArticleIds).toEqual(["art-1"]);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // art-1 is still the committed, displayed article, so the time it was on screen is a legitimate
    // reason to mark it read. The commit-boundary guard must not turn an uncommitted render into a
    // cancellation.
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: "art-1", read: true }), expect.anything());
  });

  it("ignores a pending delayed callback that lands after unmount", () => {
    const scheduledCallbacks = captureDelayedAutoMarkCallbacks(300);
    const { mutate, retainArticle, params } = createStableAutoMarkParams();

    const { unmount } = renderHook(() => useArticleAutoMark(params()));

    unmount();
    act(() => {
      scheduledCallbacks[0]?.();
    });

    expect(mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();
  });

  it("re-arms the original delay from scratch when the selected account changes", () => {
    const { mutate, params } = createStableAutoMarkParams();
    const initialProps = params();

    renderHook(() => useArticleAutoMark(initialProps));

    act(() => {
      vi.advanceTimersByTime(299);
    });
    act(() => {
      useUiStore.setState({ selectedAccountId: "account-2" });
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("cancels the delayed mark when eligibility changes before the delay elapses", () => {
    const { mutate, params } = createStableAutoMarkParams();

    const { rerender } = renderHook((props: UseArticleAutoMarkParams) => useArticleAutoMark(props), {
      initialProps: params(),
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    rerender(params({ isRead: true }));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(mutate).not.toHaveBeenCalled();
  });

  it("marks once at the original delay under StrictMode", () => {
    const { mutate, params } = createStableAutoMarkParams();

    renderHook(() => useArticleAutoMark(params()), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps the original delay through an unrelated rerender of the same article", () => {
    const { mutate, params } = createStableAutoMarkParams();

    const { rerender } = renderHook((props: UseArticleAutoMarkParams) => useArticleAutoMark(props), {
      initialProps: params(),
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(params());
    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
