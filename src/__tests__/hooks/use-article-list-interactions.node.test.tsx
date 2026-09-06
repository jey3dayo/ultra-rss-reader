import { renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles } from "@tests/helpers/fixtures";
import { requireSampleArticle } from "@tests/helpers/reader-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isArticleListNearBottom,
  useArticleListInteractions,
} from "@/components/reader/hooks/article-list/use-article-list-interactions";
import { resolveArticleCursor } from "@/lib/articles/article-list";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

// This pane is the single owner of the published `hasNextArticle` cursor value the content
// pane reads (see `useArticleViewSelection`). These tests pin that publish to
// `resolveArticleCursor` so the two stay in sync, and cover the mount lifecycle (initial
// value, updates on selection/list change, and reset on unmount) that made the previous
// ad hoc boundary check prone to drifting from actual navigation behavior (issue #54).
describe("useArticleListInteractions", () => {
  beforeEach(() => {
    useUiStore.setState({ hasNextArticle: false });
  });

  afterEach(() => {
    useUiStore.setState({ hasNextArticle: false });
  });

  it("recognizes the list viewport near its bottom without consulting window scroll", () => {
    expect(isArticleListNearBottom({ scrollHeight: 1_000, scrollTop: 700, clientHeight: 200 })).toBe(true);
    expect(isArticleListNearBottom({ scrollHeight: 1_000, scrollTop: 599, clientHeight: 200 })).toBe(false);
  });

  function renderInteractions(filteredArticles: typeof sampleArticles, selectedArticleId: string | null) {
    return renderHook(
      (props: { filteredArticles: typeof sampleArticles; selectedArticleId: string | null }) =>
        useArticleListInteractions({
          filteredArticles: props.filteredArticles,
          selectedArticleId: props.selectedArticleId,
          selectArticle: vi.fn(),
          clearArticle: vi.fn(),
          openSidebar: vi.fn(),
          toggleSidebar: vi.fn(),
          openSearch: vi.fn(),
          handleMarkAllRead: vi.fn(),
          keyboardPrefs: {},
        }),
      { initialProps: { filteredArticles, selectedArticleId } },
    );
  }

  it("publishes hasNext consistent with resolveArticleCursor for the current selection", () => {
    const middleArticleId = requireSampleArticle("art-2").id;
    const expectedCursor = resolveArticleCursor(sampleArticles, middleArticleId);

    renderInteractions(sampleArticles, middleArticleId);

    expect(useUiStore.getState().hasNextArticle).toBe(expectedCursor.hasNext);
    expect(expectedCursor.hasNext).toBe(true);
  });

  it("republishes false when the selection moves to the last navigable article", () => {
    const middleArticleId = requireSampleArticle("art-2").id;
    const lastArticleId = sampleArticles[sampleArticles.length - 1]?.id;
    if (!lastArticleId) {
      throw new Error("sampleArticles fixture must not be empty");
    }

    const { rerender } = renderInteractions(sampleArticles, middleArticleId);
    expect(useUiStore.getState().hasNextArticle).toBe(true);

    rerender({ filteredArticles: sampleArticles, selectedArticleId: lastArticleId });

    expect(useUiStore.getState().hasNextArticle).toBe(false);
  });

  it("resets the published value to false on unmount", () => {
    const middleArticleId = requireSampleArticle("art-2").id;
    const { unmount } = renderInteractions(sampleArticles, middleArticleId);
    expect(useUiStore.getState().hasNextArticle).toBe(true);

    unmount();

    expect(useUiStore.getState().hasNextArticle).toBe(false);
  });
});
