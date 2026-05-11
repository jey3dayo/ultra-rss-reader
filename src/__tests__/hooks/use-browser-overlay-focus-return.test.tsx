import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserOverlayFocusReturn } from "@/components/reader/hooks/browser/use-browser-overlay-focus-return";
import { useUiStore } from "@/stores/ui-store";

describe("useBrowserOverlayFocusReturn", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("returns focus to the selected article row when the overlay closes", () => {
    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const { rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(articleButton);
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("returns focus to the remembered open-in-browser control before the selected article row", () => {
    const openInBrowserButton = document.createElement("button");
    openInBrowserButton.dataset.browserOverlayReturnFocus = "open-in-browser";
    document.body.append(openInBrowserButton);
    openInBrowserButton.focus();

    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(openInBrowserButton);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });

  it("falls back to the previous return key when the selected article row is missing", () => {
    const previousButton = document.createElement("button");
    previousButton.dataset.browserOverlayReturnFocus = "toolbar-action";
    document.body.append(previousButton);
    previousButton.focus();

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "missing-article",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    previousButton.remove();

    const replacementButton = document.createElement("button");
    replacementButton.dataset.browserOverlayReturnFocus = "toolbar-action";
    document.body.append(replacementButton);

    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(replacementButton);
  });

  it("falls back to the previous return key when the selected article row is aria-disabled", () => {
    const previousButton = document.createElement("button");
    previousButton.dataset.browserOverlayReturnFocus = "toolbar-action";
    document.body.append(previousButton);
    previousButton.focus();

    const selectedArticleButton = document.createElement("button");
    selectedArticleButton.dataset.articleId = "article-1";
    selectedArticleButton.setAttribute("aria-disabled", "true");
    document.body.append(selectedArticleButton);

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    previousButton.remove();

    const replacementButton = document.createElement("button");
    replacementButton.dataset.browserOverlayReturnFocus = "toolbar-action";
    document.body.append(replacementButton);

    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(replacementButton);
  });

  it("falls back to the open-in-browser control when the remembered target disappeared", () => {
    const previousButton = document.createElement("button");
    previousButton.dataset.browserOverlayReturnFocus = "missing-action";
    document.body.append(previousButton);
    previousButton.focus();

    const openInBrowserButton = document.createElement("button");
    openInBrowserButton.dataset.browserOverlayReturnFocus = "open-in-browser";
    document.body.append(openInBrowserButton);

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "missing-article",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    previousButton.remove();

    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(openInBrowserButton);
  });

  it("falls back to the article list root when all return targets disappeared", () => {
    const previousButton = document.createElement("button");
    previousButton.dataset.browserOverlayReturnFocus = "missing-action";
    document.body.append(previousButton);
    previousButton.focus();

    const articleListRoot = document.createElement("div");
    articleListRoot.dataset.articleListRoot = "true";
    articleListRoot.tabIndex = -1;
    document.body.append(articleListRoot);

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "missing-article",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    previousButton.remove();

    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(articleListRoot);
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("does not refocus a disconnected previous target when the fallback root is missing", () => {
    const previousButton = document.createElement("button");
    document.body.append(previousButton);
    previousButton.focus();

    const { result, rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "missing-article",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    act(() => {
      result.current.rememberOverlayFocusReturnTarget();
    });
    previousButton.remove();

    expect(() => rerender({ isBrowserOpen: false })).not.toThrow();
    expect(document.activeElement).toBe(document.body);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });

  it("does not steal focus from a newly opened modal top layer after the overlay closes", () => {
    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const modal = document.createElement("div");
    modal.dataset.stackLayer = "dialog";
    modal.setAttribute("role", "dialog");
    const modalButton = document.createElement("button");
    modal.append(modalButton);
    document.body.append(modal);

    const { rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    modalButton.focus();
    rerender({ isBrowserOpen: false });

    expect(document.activeElement).toBe(modalButton);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });

  it("skips focus return when requestAnimationFrame is unavailable", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);

    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const { rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    expect(() => rerender({ isBrowserOpen: false })).not.toThrow();
    expect(document.activeElement).not.toBe(articleButton);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });

  it("warns and skips focus return when requestAnimationFrame throws", () => {
    const requestError = new Error("requestAnimationFrame unavailable");
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
      throw requestError;
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const { rerender } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    expect(() => rerender({ isBrowserOpen: false })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith("Failed to schedule browser overlay focus return.", requestError);
    expect(document.activeElement).not.toBe(articleButton);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });

  it("cancels the scheduled focus return when unmounted before the animation frame runs", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 42;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");

    const articleButton = document.createElement("button");
    articleButton.dataset.articleId = "article-1";
    document.body.append(articleButton);

    const { rerender, unmount } = renderHook(
      ({ isBrowserOpen }) =>
        useBrowserOverlayFocusReturn({
          articleId: "article-1",
          isBrowserOpen,
        }),
      { initialProps: { isBrowserOpen: true } },
    );

    rerender({ isBrowserOpen: false });
    unmount();
    const scheduledFrame = scheduledCallbacks[0];
    if (!scheduledFrame) {
      throw new Error("expected requestAnimationFrame callback to be scheduled");
    }
    scheduledFrame(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
    expect(document.activeElement).not.toBe(articleButton);
    expect(useUiStore.getState().focusedPane).not.toBe("list");
  });
});
