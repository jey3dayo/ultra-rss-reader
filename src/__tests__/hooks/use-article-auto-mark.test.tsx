import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleAutoMark } from "@/components/reader/hooks/article/use-article-auto-mark";
import { useUiStore } from "@/stores/ui-store";

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
      retainedArticleIds: new Set(),
      recentlyReadIds: new Set(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
      { id: "art-2", read: true },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(retainArticle).toHaveBeenCalledWith("art-2");
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
      { id: "art-1", read: true },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
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
      { id: "art-1", read: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(setRead.mutate).toHaveBeenNthCalledWith(
      2,
      { id: "art-2", read: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });
});
