import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { APP_EVENTS } from "@/constants/events";
import { getAdjacentItemId } from "@/lib/articles/article-list";
import { bindWindowEvents, createCustomEventDetailListener } from "@/lib/window/window-events";
import type { SidebarFeedNavigationParams } from "../../sidebar-feed-section.types";

function isFeedNavigationDirection(value: unknown): value is 1 | -1 {
  return value === 1 || value === -1;
}

export function useSidebarFeedNavigation({
  orderedFeedIds,
  selectedFeedId,
  expandedFolderIds,
  getFeedFolderId,
  setExpandedFolders,
  selectFeed,
}: SidebarFeedNavigationParams) {
  const latestExpandedFolderIdsRef = useRef(expandedFolderIds);

  useEffect(() => {
    latestExpandedFolderIdsRef.current = expandedFolderIds;
  }, [expandedFolderIds]);

  const navigateFeed = useCallback(
    (direction: 1 | -1) => {
      const nextFeedId = getAdjacentItemId(orderedFeedIds, selectedFeedId, direction);
      if (Result.isFailure(nextFeedId)) {
        return;
      }
      const resolvedNextFeedId = Result.unwrap(nextFeedId);

      const nextFeedFolderId = getFeedFolderId(resolvedNextFeedId) ?? null;
      const latestExpandedFolderIds = latestExpandedFolderIdsRef.current;
      if (nextFeedFolderId && !latestExpandedFolderIds.has(nextFeedFolderId)) {
        const nextExpandedFolderIds = new Set([...latestExpandedFolderIds, nextFeedFolderId]);
        latestExpandedFolderIdsRef.current = nextExpandedFolderIds;
        setExpandedFolders(nextExpandedFolderIds);
      }

      selectFeed(resolvedNextFeedId);
      requestAnimationFrame(() => {
        const nextFeedButton = document.querySelector<HTMLButtonElement>(`[data-feed-id="${resolvedNextFeedId}"]`);
        if (!nextFeedButton) {
          return;
        }

        nextFeedButton.focus({ preventScroll: true });
        nextFeedButton.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    },
    [getFeedFolderId, orderedFeedIds, selectFeed, selectedFeedId, setExpandedFolders],
  );

  useEffect(() => {
    const handler = createCustomEventDetailListener(isFeedNavigationDirection, (direction) => {
      navigateFeed(direction);
    });

    return bindWindowEvents([{ type: APP_EVENTS.navigateFeed, listener: handler }]);
  }, [navigateFeed]);
}
