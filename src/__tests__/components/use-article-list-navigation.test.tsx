import { renderHook } from "@testing-library/react";
import { sampleArticles } from "@tests/helpers/fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { useArticleListEffects } from "@/components/reader/hooks/article-list/use-article-list-effects";
import { useArticleListNavigation } from "@/components/reader/hooks/article-list/use-article-list-navigation";

describe("useArticleListNavigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("finds article rows whose data id needs selector escaping", () => {
    const nextArticle: ArticleDto = { ...sampleArticles[1], id: 'article-"quoted"' };
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const button = document.createElement("button");
    const selectArticle = vi.fn();

    button.setAttribute("data-article-id", nextArticle.id);
    list.append(button);
    document.body.append(list);
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });

    const { result } = renderHook(() =>
      useArticleListNavigation({
        filteredArticles: [sampleArticles[0], nextArticle],
        selectedArticleId: sampleArticles[0].id,
        selectArticle,
        listRef: { current: list },
        viewportRef: { current: viewport },
      }),
    );

    result.current(1);

    expect(selectArticle).toHaveBeenCalledWith(nextArticle.id, { navigationDirection: 1 });
    expect(button).toHaveFocus();

    list.remove();
  });

  it("selects the next article without focusing when the target row is missing", () => {
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const requestAnimationFrame = vi.fn();

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });
    document.body.append(list);

    const { result } = renderHook(() =>
      useArticleListNavigation({
        filteredArticles: [sampleArticles[0], sampleArticles[1]],
        selectedArticleId: sampleArticles[0].id,
        selectArticle,
        listRef: { current: list },
        viewportRef: { current: viewport },
      }),
    );

    result.current(1);

    expect(selectArticle).toHaveBeenCalledWith(sampleArticles[1].id, { navigationDirection: 1 });
    expect(document.activeElement).not.toHaveAttribute("data-article-id", sampleArticles[1].id);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("focuses a delayed target row when it appears on the retry frame", () => {
    const nextArticle = sampleArticles[1];
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requestAnimationFrameCallbacks.push(callback);
      return requestAnimationFrameCallbacks.length;
    });
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });
    document.body.append(list);

    const { result } = renderHook(() =>
      useArticleListNavigation({
        filteredArticles: [sampleArticles[0], nextArticle],
        selectedArticleId: sampleArticles[0].id,
        selectArticle,
        listRef: { current: list },
        viewportRef: { current: viewport },
      }),
    );

    result.current(1);

    const button = document.createElement("button");
    button.setAttribute("data-article-id", nextArticle.id);
    list.append(button);
    requestAnimationFrameCallbacks.forEach((callback) => {
      callback(0);
    });

    expect(selectArticle).toHaveBeenCalledWith(nextArticle.id, { navigationDirection: 1 });
    expect(button).toHaveFocus();
  });

  it("falls back to the first article for stale selections and does not wrap past the last article", () => {
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const firstButton = document.createElement("button");
    const lastButton = document.createElement("button");

    firstButton.setAttribute("data-article-id", sampleArticles[0].id);
    lastButton.setAttribute("data-article-id", sampleArticles[1].id);
    list.append(firstButton, lastButton);
    document.body.append(list);
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });

    const { result, rerender } = renderHook(
      ({ selectedArticleId }) =>
        useArticleListNavigation({
          filteredArticles: [sampleArticles[0], sampleArticles[1]],
          selectedArticleId,
          selectArticle,
          listRef: { current: list },
          viewportRef: { current: viewport },
        }),
      {
        initialProps: {
          selectedArticleId: "missing-article",
        },
      },
    );

    result.current(1);

    expect(selectArticle).toHaveBeenLastCalledWith(sampleArticles[0].id, { navigationDirection: 1 });
    expect(firstButton).toHaveFocus();

    rerender({
      selectedArticleId: sampleArticles[1].id,
    });
    result.current(1);

    expect(selectArticle).toHaveBeenLastCalledWith(sampleArticles[1].id, { navigationDirection: 1 });
    expect(lastButton).toHaveFocus();
  });

  it("keeps empty article navigation as a local no-op", () => {
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const requestAnimationFrame = vi.fn();

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

    const { result } = renderHook(() =>
      useArticleListNavigation({
        filteredArticles: [],
        selectedArticleId: null,
        selectArticle,
        listRef: { current: list },
        viewportRef: { current: viewport },
      }),
    );

    result.current(1);

    expect(selectArticle).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("keeps repeated delayed navigation focused on the latest selected article", () => {
    const thirdArticle: ArticleDto = { ...sampleArticles[1], id: "art-3", title: "Third Article" };
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const firstButton = document.createElement("button");
    const secondButton = document.createElement("button");
    const thirdButton = document.createElement("button");
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requestAnimationFrameCallbacks.push(callback);
      return requestAnimationFrameCallbacks.length;
    });
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });
    firstButton.setAttribute("data-article-id", sampleArticles[0].id);
    secondButton.setAttribute("data-article-id", sampleArticles[1].id);
    thirdButton.setAttribute("data-article-id", thirdArticle.id);
    document.body.append(list);

    const { result, rerender } = renderHook(
      ({ selectedArticleId }) =>
        useArticleListNavigation({
          filteredArticles: [sampleArticles[0], sampleArticles[1], thirdArticle],
          selectedArticleId,
          selectArticle,
          listRef: { current: list },
          viewportRef: { current: viewport },
        }),
      {
        initialProps: {
          selectedArticleId: sampleArticles[0].id,
        },
      },
    );

    result.current(1);
    rerender({
      selectedArticleId: sampleArticles[1].id,
    });
    result.current(1);

    list.append(secondButton, thirdButton);
    requestAnimationFrameCallbacks.forEach((callback) => {
      callback(0);
    });

    expect(selectArticle).toHaveBeenNthCalledWith(1, sampleArticles[1].id, { navigationDirection: 1 });
    expect(selectArticle).toHaveBeenNthCalledWith(2, thirdArticle.id, { navigationDirection: 1 });
    expect(thirdButton).toHaveFocus();
    expect(secondButton).not.toHaveFocus();
  });

  it("does not restore focus to a delayed navigation target after the search result set changes", () => {
    const selectArticle = vi.fn();
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const secondButton = document.createElement("button");
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requestAnimationFrameCallbacks.push(callback);
      return requestAnimationFrameCallbacks.length;
    });
    Object.defineProperty(viewport, "clientHeight", { value: 200 });
    Object.defineProperty(viewport, "scrollHeight", { value: 400 });
    secondButton.setAttribute("data-article-id", sampleArticles[1].id);
    document.body.append(list);

    const { result, rerender } = renderHook(
      ({ filteredArticles }) =>
        useArticleListNavigation({
          filteredArticles,
          selectedArticleId: sampleArticles[0].id,
          selectArticle,
          listRef: { current: list },
          viewportRef: { current: viewport },
        }),
      {
        initialProps: {
          filteredArticles: [sampleArticles[0], sampleArticles[1]],
        },
      },
    );

    result.current(1);
    rerender({
      filteredArticles: [sampleArticles[0]],
    });

    list.append(secondButton);
    requestAnimationFrameCallbacks.forEach((callback) => {
      callback(0);
    });

    expect(selectArticle).toHaveBeenCalledWith(sampleArticles[1].id, { navigationDirection: 1 });
    expect(secondButton).not.toHaveFocus();
  });
});

describe("useArticleListEffects", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("clears a deleted selected article without restoring focus to its stale row", () => {
    const list = document.createElement("div");
    const viewport = document.createElement("div");
    const deletedButton = document.createElement("button");
    const fallbackButton = document.createElement("button");
    const clearArticle = vi.fn();
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requestAnimationFrameCallbacks.push(callback);
      return requestAnimationFrameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    deletedButton.setAttribute("data-article-id", sampleArticles[1].id);
    fallbackButton.setAttribute("data-article-id", sampleArticles[0].id);
    list.append(deletedButton);
    document.body.append(list);

    const { rerender } = renderHook(
      ({ filteredArticles, selectedArticleId }) =>
        useArticleListEffects({
          selection: { type: "all" },
          scrollToTopOnChange: "false",
          listRef: { current: list },
          viewportRef: { current: viewport },
          filteredArticles,
          focusedPane: "list",
          selectedArticleId,
          isPrimarySourceLoading: false,
          clearArticle,
        }),
      {
        initialProps: {
          filteredArticles: [sampleArticles[0], sampleArticles[1]],
          selectedArticleId: sampleArticles[1].id,
        },
      },
    );

    list.replaceChildren(fallbackButton);
    rerender({
      filteredArticles: [sampleArticles[0]],
      selectedArticleId: sampleArticles[1].id,
    });
    requestAnimationFrameCallbacks.forEach((callback) => {
      callback(0);
    });

    expect(clearArticle).toHaveBeenCalledTimes(1);
    expect(deletedButton).not.toHaveFocus();
    expect(fallbackButton).not.toHaveFocus();
  });
});
