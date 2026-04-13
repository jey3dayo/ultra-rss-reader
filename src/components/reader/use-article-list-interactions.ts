import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback, useMemo, useRef } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { buildKeyToActionMap, resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";
import { handleArticleListKeyboardAction } from "./article-list-keyboard-action";
import { useArticleListGlobalEvents } from "./use-article-list-global-events";
import { useArticleListNavigation } from "./use-article-list-navigation";

type UseArticleListInteractionsParams = {
  filteredArticles: ArticleDto[];
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: () => void;
  openSidebar: () => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  handleMarkAllRead: () => void;
  keyboardPrefs: Parameters<typeof buildKeyToActionMap>[0];
};

type UseArticleListInteractionsResult = {
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  handleListKeyDownCapture: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

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

  useArticleListGlobalEvents({
    onNavigateArticle: navigateArticle,
    onFocusSearch: openSearch,
    onMarkAllRead: handleMarkAllRead,
  });

  const handleListKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[role="option"]')) {
        return;
      }

      const action = resolveKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        targetTag: target.tagName,
        selectedArticleId,
        contentMode: useUiStore.getState().contentMode,
        viewMode: useUiStore.getState().viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`list-key ${event.key} -> ${resolvedAction.type}`);
      handleArticleListKeyboardAction({
        action: resolvedAction,
        clearArticle,
        toggleSidebar,
        openSidebar,
      });
    },
    [clearArticle, keyToAction, openSidebar, selectedArticleId, toggleSidebar],
  );

  return {
    listRef,
    viewportRef,
    handleListKeyDownCapture,
  };
}
