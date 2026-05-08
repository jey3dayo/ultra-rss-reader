import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useArticleListGlobalEvents } from "@/components/reader/hooks/article-list/use-article-list-global-events";
import { APP_EVENTS } from "@/constants/events";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";

describe("useArticleListGlobalEvents", () => {
  it("ignores navigate article events with invalid detail", () => {
    const onNavigateArticle = vi.fn();

    renderHook(() =>
      useArticleListGlobalEvents({
        onNavigateArticle,
        onFocusSearch: vi.fn(),
        onMarkAllRead: vi.fn(),
      }),
    );

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: "next" }));
    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: 0 }));
    window.dispatchEvent(new Event(APP_EVENTS.navigateArticle));

    expect(onNavigateArticle).not.toHaveBeenCalled();
  });

  it("removes global listeners when dependencies change and on unmount", () => {
    const firstNavigateArticle = vi.fn();
    const firstFocusSearch = vi.fn();
    const firstMarkAllRead = vi.fn();
    const nextNavigateArticle = vi.fn();
    const nextFocusSearch = vi.fn();
    const nextMarkAllRead = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ onNavigateArticle, onFocusSearch, onMarkAllRead }) =>
        useArticleListGlobalEvents({
          onNavigateArticle,
          onFocusSearch,
          onMarkAllRead,
        }),
      {
        initialProps: {
          onNavigateArticle: firstNavigateArticle,
          onFocusSearch: firstFocusSearch,
          onMarkAllRead: firstMarkAllRead,
        },
      },
    );

    rerender({
      onNavigateArticle: nextNavigateArticle,
      onFocusSearch: nextFocusSearch,
      onMarkAllRead: nextMarkAllRead,
    });

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: 1 }));
    window.dispatchEvent(new Event(keyboardEvents.focusSearch));
    window.dispatchEvent(new Event(keyboardEvents.markAllRead));

    expect(firstNavigateArticle).not.toHaveBeenCalled();
    expect(firstFocusSearch).not.toHaveBeenCalled();
    expect(firstMarkAllRead).not.toHaveBeenCalled();
    expect(nextNavigateArticle).toHaveBeenCalledWith(1);
    expect(nextFocusSearch).toHaveBeenCalledTimes(1);
    expect(nextMarkAllRead).toHaveBeenCalledTimes(1);

    unmount();

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: -1 }));
    window.dispatchEvent(new Event(keyboardEvents.focusSearch));
    window.dispatchEvent(new Event(keyboardEvents.markAllRead));

    expect(nextNavigateArticle).toHaveBeenCalledTimes(1);
    expect(nextFocusSearch).toHaveBeenCalledTimes(1);
    expect(nextMarkAllRead).toHaveBeenCalledTimes(1);
  });
});
