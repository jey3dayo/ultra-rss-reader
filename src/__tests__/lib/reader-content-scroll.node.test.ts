import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveArticleContentScrollContainer,
  scrollArticleContentByViewport,
} from "@/lib/reader/reader-content-scroll";

setupBrowserTestDom();

function renderScrollableArticleContent(): HTMLElement {
  document.body.innerHTML = `
    <div data-slot="scroll-area-viewport">
      <article>
        <div data-reader-scroll-anchor="article-content"></div>
      </article>
    </div>
  `;
  const viewport = document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (!viewport) {
    throw new Error("Expected scroll-area-viewport to render");
  }
  return viewport;
}

function stubScrollMetrics(viewport: HTMLElement, metrics: { clientHeight: number; scrollHeight: number }): void {
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: metrics.clientHeight });
  Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: metrics.scrollHeight });
}

describe("reader content scroll", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("resolves the scroll-area viewport ancestor of the article content anchor", () => {
    const viewport = renderScrollableArticleContent();
    expect(resolveArticleContentScrollContainer()).toBe(viewport);
  });

  it("returns unavailable when the article content anchor is not rendered", () => {
    document.body.innerHTML = "<div>no anchor here</div>";
    expect(scrollArticleContentByViewport(1)).toBe("unavailable");
  });

  it("scrolls down by ~85% of the viewport height and reports scrolled", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 2000 });
    viewport.scrollTop = 0;
    const scrollBySpy = vi.fn();
    viewport.scrollBy = scrollBySpy;

    const result = scrollArticleContentByViewport(1);

    expect(result).toBe("scrolled");
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ top: 340 }));
  });

  it("scrolls up when direction is -1", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 2000 });
    viewport.scrollTop = 800;
    const scrollBySpy = vi.fn();
    viewport.scrollBy = scrollBySpy;

    const result = scrollArticleContentByViewport(-1);

    expect(result).toBe("scrolled");
    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ top: -340 }));
  });

  it("reports reached-end without scrolling further when already at the bottom", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 1200 });
    viewport.scrollTop = 800;
    const scrollBySpy = vi.fn();
    viewport.scrollBy = scrollBySpy;

    const result = scrollArticleContentByViewport(1);

    expect(result).toBe("reached-end");
    expect(scrollBySpy).not.toHaveBeenCalled();
  });

  it("has no special reached-end behavior scrolling up from the top", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 2000 });
    viewport.scrollTop = 0;
    const scrollBySpy = vi.fn();
    viewport.scrollBy = scrollBySpy;

    const result = scrollArticleContentByViewport(-1);

    expect(result).toBe("scrolled");
    expect(scrollBySpy).toHaveBeenCalled();
  });

  it("falls back to auto scrolling when the user prefers reduced motion", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 2000 });
    viewport.scrollTop = 0;
    const scrollBySpy = vi.fn();
    viewport.scrollBy = scrollBySpy;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    scrollArticleContentByViewport(1);

    expect(scrollBySpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
  });

  it("falls back to setting scrollTop directly when scrollBy throws", () => {
    const viewport = renderScrollableArticleContent();
    stubScrollMetrics(viewport, { clientHeight: 400, scrollHeight: 2000 });
    viewport.scrollTop = 0;
    viewport.scrollBy = () => {
      throw new Error("scrollBy unavailable");
    };

    const result = scrollArticleContentByViewport(1);

    expect(result).toBe("scrolled");
    expect(viewport.scrollTop).toBe(340);
  });
});
