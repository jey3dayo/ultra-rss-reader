import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SetReadMutation, ToggleStarMutation } from "@/components/reader/article-actions.types";
import { useArticleStatusActions } from "@/components/reader/hooks/article/use-article-status-actions";

describe("useArticleStatusActions", () => {
  it("removes recently-read state when an article is marked unread", () => {
    const addRecentlyRead = vi.fn();
    const removeRecentlyRead = vi.fn();
    const retainArticle = vi.fn();
    const showToast = vi.fn();

    const setRead: SetReadMutation = {
      mutate: vi.fn((_variables, options) => {
        options?.onSuccess?.(undefined, _variables, undefined);
      }),
    };

    const toggleStar: ToggleStarMutation = {
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
});
