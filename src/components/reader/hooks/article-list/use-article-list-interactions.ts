import { useCallback, useEffect, useMemo, useRef } from "react";
import { useArticleListGlobalEvents } from "@/components/reader/hooks/article-list/use-article-list-global-events";
import { useArticleListKeydownHandler } from "@/components/reader/hooks/article-list/use-article-list-keydown-handler";
import { useArticleListNavigation } from "@/components/reader/hooks/article-list/use-article-list-navigation";
import { resolveArticleCursor } from "@/lib/articles/article-list";
import { buildKeyToActionMap } from "@/lib/keyboard/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";
import type {
  UseArticleListInteractionsParams,
  UseArticleListInteractionsResult,
} from "./article-list-controller.types";

export function isArticleListNearBottom(
  viewport: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">,
  threshold = 200,
): boolean {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
}

export function useArticleListInteractions({
  filteredArticles,
  selectedArticleId,
  selectArticle,
  clearArticle,
  openSidebar,
  toggleSidebar,
  openSearch,
  handleMarkAllRead,
  keyboardPrefs,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
  isSearchVisible = false,
}: UseArticleListInteractionsParams): UseArticleListInteractionsResult {
  const keyToAction = useMemo(() => buildKeyToActionMap(keyboardPrefs), [keyboardPrefs]);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const navigateArticle = useArticleListNavigation({
    filteredArticles,
    selectedArticleId,
    selectArticle,
    listRef,
    viewportRef,
  });

  const setHasNextArticle = useUiStore((state) => state.setHasNextArticle);
  const isLoadingNextPageRef = useRef(false);

  const loadNextPageIfNearBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (
      !viewport ||
      isSearchVisible ||
      !fetchNextPage ||
      !hasNextPage ||
      isFetchingNextPage ||
      isLoadingNextPageRef.current ||
      !isArticleListNearBottom(viewport)
    ) {
      return;
    }

    isLoadingNextPageRef.current = true;
    void fetchNextPage().then(
      () => {
        isLoadingNextPageRef.current = false;
      },
      () => {
        isLoadingNextPageRef.current = false;
      },
    );
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isSearchVisible]);

  // `loadNextPageIfNearBottom` is recreated whenever `isFetchingNextPage` flips, including the
  // false->false-with-no-new-data transition after a failed fetch. The mount/content-change and
  // resize-driven effects below must not re-run merely because that identity changed (that would
  // fire an immediate auto-retry loop right after a failure); they read the latest callback through
  // this ref instead of depending on the callback itself, so they only re-invoke it on their own
  // real triggers (mount, article list content change, viewport/window resize).
  const loadNextPageIfNearBottomRef = useRef(loadNextPageIfNearBottom);

  // Ref mutation must happen in an effect, not during render: React's concurrent rendering can
  // discard and re-run a render pass, and mutating a ref mid-render is unsound under that model.
  // This effect must be declared before the effects below that read `loadNextPageIfNearBottomRef`
  // (mount/content-change, ResizeObserver, window resize), since same-component effects run in
  // declaration order and a reversed order would read a stale callback.
  useEffect(() => {
    loadNextPageIfNearBottomRef.current = loadNextPageIfNearBottom;
  }, [loadNextPageIfNearBottom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.addEventListener("scroll", loadNextPageIfNearBottom);
    return () => viewport.removeEventListener("scroll", loadNextPageIfNearBottom);
  }, [loadNextPageIfNearBottom]);

  // Scroll events alone miss the case where a page of results already fills (or under-fills) a
  // tall viewport: the list never becomes scrollable, so no "scroll" event ever fires and
  // `hasNextPage` stays stuck true forever. Re-run the same bottom check after initial mount and
  // after the article list content changes (a page finished loading, or the source switched).
  // Deliberately depends on `filteredArticles` only, not on `loadNextPageIfNearBottom` itself, so a
  // failed fetch (which changes `isFetchingNextPage` but not `filteredArticles`) does not retrigger
  // this effect and cause an immediate auto-retry loop.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run the bottom check when the article list content changes
  useEffect(() => {
    loadNextPageIfNearBottomRef.current();
  }, [filteredArticles]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      loadNextPageIfNearBottomRef.current();
    });
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      loadNextPageIfNearBottomRef.current();
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // This pane owns the list that `navigateArticle` actually walks (search results included), so it
  // publishes whether a next article exists via `resolveArticleCursor`, which applies the same
  // `getAdjacentArticleId` clamp rule that `useArticleListNavigation` checks (that hook still calls
  // `getAdjacentArticleId` directly because boundary hits re-select the current article there,
  // which the cursor's null-on-boundary shape does not express). The content pane renders its
  // next-article control from this published value instead of re-deriving it from its own
  // source-agnostic list, because that list is built without search applied (see
  // `useArticleViewSelection`). Unmounting this pane also drops the `navigateArticle` listener, so
  // publishing "no next" on cleanup stays accurate for as long as this pane is the one mounted;
  // when this pane never mounts at all (e.g. content-only layout before the list pane is visited),
  // the published value is not corrected — see docs/reader-article-scope-matrix.md.
  useEffect(() => {
    const cursor = resolveArticleCursor(filteredArticles, selectedArticleId);
    setHasNextArticle(cursor.hasNext);

    return () => {
      setHasNextArticle(false);
    };
  }, [filteredArticles, selectedArticleId, setHasNextArticle]);

  useArticleListGlobalEvents({
    onNavigateArticle: navigateArticle,
    onFocusSearch: openSearch,
    onMarkAllRead: handleMarkAllRead,
  });

  const handleListKeyDownCapture = useArticleListKeydownHandler({
    selectedArticleId,
    selectArticle,
    clearArticle,
    toggleSidebar,
    openSidebar,
    keyToAction,
  });

  return {
    listRef,
    viewportRef,
    handleListKeyDownCapture,
  };
}
