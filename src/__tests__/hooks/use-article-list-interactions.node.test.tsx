import { render, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { sampleArticles } from "@tests/helpers/fixtures";
import { requireSampleArticle } from "@tests/helpers/reader-fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseArticleListInteractionsParams } from "@/components/reader/hooks/article-list/article-list-controller.types";
import {
  isArticleListNearBottom,
  useArticleListInteractions,
} from "@/components/reader/hooks/article-list/use-article-list-interactions";
import { resolveArticleCursor } from "@/lib/articles/article-list";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

function setScrollMetrics(element: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

type ViewportMetrics = { clientHeight: number; scrollHeight: number; scrollTop?: number };

// Mounts the real hook behind a rendered DOM node (unlike bare `renderHook`, which never attaches
// `viewportRef` to anything) so the near-bottom auto-fetch effects can read real `scrollHeight` /
// `clientHeight` values, matching how `article-list-body.tsx` attaches this ref in production.
// `initialMetrics`, when given, is applied through the ref callback during the commit phase, so it
// is already in place before the mount effect (a passive effect) runs its near-bottom check.
function ArticleListInteractionsHarness({
  args,
  initialMetrics,
}: {
  args: UseArticleListInteractionsParams;
  initialMetrics?: ViewportMetrics;
}) {
  const result = useArticleListInteractions(args);
  return (
    <div
      ref={(node) => {
        result.viewportRef.current = node;
        if (node && initialMetrics) {
          setScrollMetrics(node, initialMetrics.clientHeight, initialMetrics.scrollHeight);
          if (initialMetrics.scrollTop !== undefined) {
            Object.defineProperty(node, "scrollTop", { configurable: true, value: initialMetrics.scrollTop });
          }
        }
      }}
      data-testid="viewport"
    />
  );
}

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

  function buildInteractionArgs(
    overrides: Partial<UseArticleListInteractionsParams>,
  ): UseArticleListInteractionsParams {
    return {
      filteredArticles: sampleArticles,
      selectedArticleId: null,
      selectArticle: vi.fn(),
      clearArticle: vi.fn(),
      openSidebar: vi.fn(),
      toggleSidebar: vi.fn(),
      openSearch: vi.fn(),
      handleMarkAllRead: vi.fn(),
      keyboardPrefs: {},
      ...overrides,
    };
  }

  // A page of results that already fills (or under-fills) a tall viewport never fires a "scroll"
  // event, so the fetch must also be triggered from the initial mount check. This pins that path
  // directly, independent of any user scrolling (issue: initial-load pagination stall).
  it("fetches the next page on initial mount when the viewport starts unscrollable", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);

    render(
      <ArticleListInteractionsHarness
        args={buildInteractionArgs({ fetchNextPage, hasNextPage: true, isFetchingNextPage: false })}
        initialMetrics={{ clientHeight: 200, scrollHeight: 100 }}
      />,
    );

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not fetch on mount when the viewport already scrolls past the bottom threshold", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);

    render(
      <ArticleListInteractionsHarness
        args={buildInteractionArgs({ fetchNextPage, hasNextPage: true, isFetchingNextPage: false })}
        initialMetrics={{ clientHeight: 200, scrollHeight: 1_000, scrollTop: 0 }}
      />,
    );

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  // `loadNextPageIfNearBottom` is recreated whenever `isFetchingNextPage` flips, including the
  // false -> false transition after a failed fetch settles with no new data. The mount/content
  // effect must not treat that identity change as a new trigger, or a failed fetch would
  // immediately re-fire itself in a retry loop.
  it("does not automatically retry immediately after a failed fetch settles", () => {
    const fetchNextPage = vi.fn().mockRejectedValue(new Error("boom"));
    const filteredArticles = sampleArticles;
    const baseArgs = buildInteractionArgs({ filteredArticles, fetchNextPage, hasNextPage: true });

    const { rerender } = render(<ArticleListInteractionsHarness args={{ ...baseArgs, isFetchingNextPage: false }} />);

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    fetchNextPage.mockClear();

    // The query enters the fetching state for the (failing) request already in flight.
    rerender(<ArticleListInteractionsHarness args={{ ...baseArgs, isFetchingNextPage: true }} />);
    expect(fetchNextPage).not.toHaveBeenCalled();

    // The query settles back to idle after the failure; `filteredArticles` never changed because
    // no new page arrived, so the mount/content-change effect must not refire.
    rerender(<ArticleListInteractionsHarness args={{ ...baseArgs, isFetchingNextPage: false }} />);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
