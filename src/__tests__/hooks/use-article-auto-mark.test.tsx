import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleAutoMark } from "@/components/reader/hooks/article/use-article-auto-mark";

type UseArticleAutoMarkParams = Parameters<typeof useArticleAutoMark>[0];

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
});
