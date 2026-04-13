import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import type { UseArticleListGlobalEventsParams } from "./article-list.types";

export function useArticleListGlobalEvents({
  onNavigateArticle,
  onFocusSearch,
  onMarkAllRead,
}: UseArticleListGlobalEventsParams) {
  useEffect(() => {
    const handler = (event: Event) => {
      onNavigateArticle((event as CustomEvent<1 | -1>).detail);
    };

    window.addEventListener(APP_EVENTS.navigateArticle, handler);
    return () => {
      window.removeEventListener(APP_EVENTS.navigateArticle, handler);
    };
  }, [onNavigateArticle]);

  useEffect(() => {
    window.addEventListener(keyboardEvents.focusSearch, onFocusSearch);
    window.addEventListener(keyboardEvents.markAllRead, onMarkAllRead);
    return () => {
      window.removeEventListener(keyboardEvents.focusSearch, onFocusSearch);
      window.removeEventListener(keyboardEvents.markAllRead, onMarkAllRead);
    };
  }, [onFocusSearch, onMarkAllRead]);
}
