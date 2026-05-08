import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UseArticleStatusActionsParams } from "@/components/reader/hooks/article/use-article-status-actions";
import { useArticleStatusActions } from "@/components/reader/hooks/article/use-article-status-actions";

describe("useArticleStatusActions", () => {
  it("removes recently-read state when an article is marked unread", () => {
    const addRecentlyRead = vi.fn();
    const removeRecentlyRead = vi.fn();
    const retainArticle = vi.fn();
    const showToast = vi.fn();

    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn((_variables, options) => {
        options?.onSuccess?.(undefined, _variables, undefined);
      }),
    };

    const toggleStar: UseArticleStatusActionsParams["toggleStar"] = {
      mutate: vi.fn(),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions({
        articleId: "art-1",
        isRead: true,
        isStarred: true,
        viewMode: "all",
        retainOnUnstar: false,
        showToast,
        addRecentlyRead,
        removeRecentlyRead,
        retainArticle,
        setRead,
        toggleStar,
        starredMessage: "starred",
        unstarredMessage: "unstarred",
      }),
    );

    act(() => {
      result.current.setReadStatus(false);
    });

    expect(setRead.mutate).toHaveBeenCalledWith(
      { id: "art-1", read: false },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
    expect(removeRecentlyRead).toHaveBeenCalledWith("art-1");
    expect(addRecentlyRead).not.toHaveBeenCalled();
  });

  it("does not mutate, retain, or toast when articleId is null", () => {
    const addRecentlyRead = vi.fn();
    const removeRecentlyRead = vi.fn();
    const retainArticle = vi.fn();
    const showToast = vi.fn();

    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn(),
    };

    const toggleStar: UseArticleStatusActionsParams["toggleStar"] = {
      mutate: vi.fn(),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions({
        articleId: null,
        isRead: false,
        isStarred: false,
        viewMode: "unread",
        retainOnUnstar: true,
        showToast,
        addRecentlyRead,
        removeRecentlyRead,
        retainArticle,
        setRead,
        toggleStar,
        starredMessage: "starred",
        unstarredMessage: "unstarred",
      }),
    );

    act(() => {
      result.current.setReadStatus(true);
      result.current.setStarStatus(true, { showStatusToast: true });
      result.current.handleToggleRead();
      result.current.handleToggleStar();
    });

    expect(setRead.mutate).not.toHaveBeenCalled();
    expect(toggleStar.mutate).not.toHaveBeenCalled();
    expect(retainArticle).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(addRecentlyRead).not.toHaveBeenCalled();
    expect(removeRecentlyRead).not.toHaveBeenCalled();
  });
});
