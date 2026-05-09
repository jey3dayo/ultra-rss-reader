import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  isWindowNavigationDirection,
} from "@/lib/window/window-events";

type UseArticleListGlobalEventsParams = {
  onNavigateArticle: (direction: 1 | -1) => void;
  onFocusSearch: () => void;
  onMarkAllRead: () => void;
};

export function useArticleListGlobalEvents({
  onNavigateArticle,
  onFocusSearch,
  onMarkAllRead,
}: UseArticleListGlobalEventsParams) {
  useEffect(() => {
    const handler = createCustomEventDetailListener(isWindowNavigationDirection, onNavigateArticle);

    return bindWindowEvents([{ type: APP_EVENTS.navigateArticle, listener: handler }]);
  }, [onNavigateArticle]);

  useEffect(() => {
    return bindWindowEvents([
      { type: keyboardEvents.focusSearch, listener: onFocusSearch },
      { type: keyboardEvents.markAllRead, listener: onMarkAllRead },
    ]);
  }, [onFocusSearch, onMarkAllRead]);
}
