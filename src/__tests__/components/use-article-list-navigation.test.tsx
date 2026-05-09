import { renderHook } from "@testing-library/react";
import { sampleArticles } from "@tests/helpers/fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
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
});
