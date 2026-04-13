import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useMemo, useRef } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { buildKeyToActionMap } from "@/lib/keyboard-shortcuts";
import { useArticleListGlobalEvents } from "./use-article-list-global-events";
import { useArticleListKeydownHandler } from "./use-article-list-keydown-handler";
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

  const handleListKeyDownCapture = useArticleListKeydownHandler({
    selectedArticleId,
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
