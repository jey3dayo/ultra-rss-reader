import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import type { UseArticleListGlobalEventsParams } from "./article-list.types";
import { bindWindowEvents } from "./use-browser-url-effect";

export function useArticleListGlobalEvents({
  onNavigateArticle,
  onFocusSearch,
  onMarkAllRead,
}: UseArticleListGlobalEventsParams) {
  useEffect(() => {
    const handler = (event: Event) => {
      onNavigateArticle((event as CustomEvent<1 | -1>).detail);
    };

    return bindWindowEvents([{ type: APP_EVENTS.navigateArticle, listener: handler }]);
  }, [onNavigateArticle]);

  useEffect(() => {
    return bindWindowEvents([
      { type: keyboardEvents.focusSearch, listener: onFocusSearch },
      { type: keyboardEvents.markAllRead, listener: onMarkAllRead },
    ]);
  }, [onFocusSearch, onMarkAllRead]);
}
