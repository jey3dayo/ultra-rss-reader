import { useCallback, useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";

type UseSidebarFeedNavigationParams = {
  orderedFeedIds: string[];
  selectedFeedId: string | null;
  expandedFolderIds: Set<string>;
  getFeedFolderId: (feedId: string) => string | null | undefined;
  setExpandedFolders: (folderIds: string[]) => void;
  selectFeed: (feedId: string) => void;
};

export function useSidebarFeedNavigation({
  orderedFeedIds,
  selectedFeedId,
  expandedFolderIds,
  getFeedFolderId,
  setExpandedFolders,
  selectFeed,
}: UseSidebarFeedNavigationParams) {
  const navigateFeed = useCallback(
    (direction: 1 | -1) => {
      if (orderedFeedIds.length === 0) {
        return;
      }

      const currentIndex = selectedFeedId ? orderedFeedIds.indexOf(selectedFeedId) : -1;
      let nextIndex: number;
      if (currentIndex === -1) {
        nextIndex = direction === 1 ? 0 : orderedFeedIds.length - 1;
      } else {
        nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= orderedFeedIds.length) {
          return;
        }
      }

      const nextFeedId = orderedFeedIds[nextIndex];
      if (!nextFeedId) {
        return;
      }

      const nextFeedFolderId = getFeedFolderId(nextFeedId);
      if (nextFeedFolderId && !expandedFolderIds.has(nextFeedFolderId)) {
        setExpandedFolders([...expandedFolderIds, nextFeedFolderId]);
      }

      selectFeed(nextFeedId);
      requestAnimationFrame(() => {
        const nextFeedButton = document.querySelector<HTMLButtonElement>(`[data-feed-id="${nextFeedId}"]`);
        if (!nextFeedButton) {
          return;
        }

        nextFeedButton.focus({ preventScroll: true });
        nextFeedButton.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    },
    [expandedFolderIds, getFeedFolderId, orderedFeedIds, selectFeed, selectedFeedId, setExpandedFolders],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const direction = (event as CustomEvent<1 | -1>).detail;
      navigateFeed(direction);
    };

    window.addEventListener(APP_EVENTS.navigateFeed, handler);
    return () => {
      window.removeEventListener(APP_EVENTS.navigateFeed, handler);
    };
  }, [navigateFeed]);
}
