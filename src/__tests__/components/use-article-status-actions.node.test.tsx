import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseArticleStatusActionsParams } from "@/components/reader/hooks/article/use-article-status-actions";
import { useArticleStatusActions } from "@/components/reader/hooks/article/use-article-status-actions";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

type SetReadMutate = UseArticleStatusActionsParams["setRead"]["mutate"];
type ToggleStarMutate = UseArticleStatusActionsParams["toggleStar"]["mutate"];

function createMutationContext() {
  return {
    client: new QueryClient(),
    meta: undefined,
  };
}

function createParams(overrides: Partial<UseArticleStatusActionsParams> = {}): UseArticleStatusActionsParams {
  return {
    articleId: "art-1",
    isRead: false,
    isStarred: false,
    viewMode: "all",
    retainOnUnstar: false,
    showToast: vi.fn(),
    addRecentlyRead: vi.fn(),
    removeRecentlyRead: vi.fn(),
    retainArticle: vi.fn(),
    setRead: {
      mutate: vi.fn(),
    },
    toggleStar: {
      mutate: vi.fn(),
    },
    markedReadMessage: "marked read",
    markedUnreadMessage: "marked unread",
    starredMessage: "starred",
    unstarredMessage: "unstarred",
    ...overrides,
  };
}

describe("useArticleStatusActions", () => {
  beforeEach(() => {
    useUiStore.setState({
      retainedArticleIds: new Set(),
      recentlyReadIds: new Set(),
    });
  });

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
        markedReadMessage: "marked read",
        markedUnreadMessage: "marked unread",
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
    expect(showToast).toHaveBeenCalledWith("marked unread");
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
        markedReadMessage: "marked read",
        markedUnreadMessage: "marked unread",
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

  it("shows recovery copy after marking an article read", () => {
    const showToast = vi.fn();
    const addRecentlyRead = vi.fn();
    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn((variables, options) => {
        options?.onSuccess?.(undefined, variables, undefined);
      }),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          addRecentlyRead,
          setRead,
          showToast,
        }),
      ),
    );

    act(() => {
      result.current.setReadStatus(true);
    });

    expect(addRecentlyRead).toHaveBeenCalledWith("art-1");
    expect(showToast).toHaveBeenCalledWith("marked read");
  });

  it("rolls back newly retained unread articles and shows a toast when marking read fails", () => {
    const showToast = vi.fn();
    const mutate: SetReadMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark read"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
        }),
      ),
    );

    act(() => {
      result.current.setReadStatus(true);
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
    expect(showToast).toHaveBeenCalledWith("Failed to mark read");
  });

  it("keeps pre-existing retained unread articles when marking read fails", () => {
    useUiStore.getState().retainArticle("art-1");
    const showToast = vi.fn();
    const mutate: SetReadMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark read"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          viewMode: "unread",
          retainArticle: useUiStore.getState().retainArticle,
          setRead,
          showToast,
        }),
      ),
    );

    act(() => {
      result.current.setReadStatus(true);
    });

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
    expect(showToast).toHaveBeenCalledWith("Failed to mark read");
  });

  it("keeps recently-read state unchanged when marking unread fails", () => {
    const addRecentlyRead = vi.fn();
    const removeRecentlyRead = vi.fn();
    const showToast = vi.fn();
    const mutate: SetReadMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to mark unread"), variables, undefined, createMutationContext());
    };
    const setRead: UseArticleStatusActionsParams["setRead"] = {
      mutate: vi.fn(mutate),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          isRead: true,
          addRecentlyRead,
          removeRecentlyRead,
          setRead,
          showToast,
        }),
      ),
    );

    act(() => {
      result.current.setReadStatus(false);
    });

    expect(addRecentlyRead).not.toHaveBeenCalled();
    expect(removeRecentlyRead).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Failed to mark unread");
  });

  it("shows a toast without status success copy when starring fails", () => {
    const showToast = vi.fn();
    const retainArticle = vi.fn();
    const mutate: ToggleStarMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to star"), variables, undefined, createMutationContext());
    };
    const toggleStar: UseArticleStatusActionsParams["toggleStar"] = {
      mutate: vi.fn(mutate),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          retainArticle,
          retainOnUnstar: true,
          showToast,
          toggleStar,
        }),
      ),
    );

    act(() => {
      result.current.setStarStatus(true, { showStatusToast: true });
    });

    expect(showToast).toHaveBeenCalledWith("Failed to star");
    expect(showToast).not.toHaveBeenCalledWith("starred");
    expect(retainArticle).not.toHaveBeenCalled();
  });

  it("does not retain the article when unstarring fails in unread mode", () => {
    const showToast = vi.fn();
    const retainArticle = vi.fn();
    const mutate: ToggleStarMutate = (variables, options) => {
      options?.onError?.(new Error("Failed to unstar"), variables, undefined, createMutationContext());
    };
    const toggleStar: UseArticleStatusActionsParams["toggleStar"] = {
      mutate: vi.fn(mutate),
    };

    const { result } = renderHook(() =>
      useArticleStatusActions(
        createParams({
          isStarred: true,
          retainArticle,
          retainOnUnstar: true,
          showToast,
          toggleStar,
          viewMode: "unread",
        }),
      ),
    );

    act(() => {
      result.current.setStarStatus(false, { showStatusToast: true });
    });

    expect(retainArticle).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Failed to unstar");
    expect(showToast).not.toHaveBeenCalledWith("unstarred");
  });
});
