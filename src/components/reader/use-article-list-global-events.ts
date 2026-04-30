import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { bindWindowEvents, createCustomEventDetailListener } from "@/lib/window-events";
import type { UseArticleListGlobalEventsParams } from "./article-list.types";

function isArticleNavigationDirection(value: unknown): value is 1 | -1 {
  return value === 1 || value === -1;
}

export function useArticleListGlobalEvents({
  onNavigateArticle,
  onFocusSearch,
  onMarkAllRead,
}: UseArticleListGlobalEventsParams) {
  useEffect(() => {
    const handler = createCustomEventDetailListener(isArticleNavigationDirection, onNavigateArticle);

    return bindWindowEvents([{ type: APP_EVENTS.navigateArticle, listener: handler }]);
  }, [onNavigateArticle]);

  useEffect(() => {
    return bindWindowEvents([
      { type: keyboardEvents.focusSearch, listener: onFocusSearch },
      { type: keyboardEvents.markAllRead, listener: onMarkAllRead },
    ]);
  }, [onFocusSearch, onMarkAllRead]);
}
