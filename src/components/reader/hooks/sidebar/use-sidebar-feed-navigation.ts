import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { APP_EVENTS } from "@/constants/events";
import { getAdjacentItemId } from "@/lib/articles/article-list";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
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
  const latestSelectedFeedIdRef = useRef(selectedFeedId);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    latestExpandedFolderIdsRef.current = expandedFolderIds;
  }, [expandedFolderIds]);

  useEffect(() => {
    latestSelectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (pendingFocusFrameRef.current !== null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
        pendingFocusFrameRef.current = null;
      }
    };
  }, []);

  const navigateFeed = useCallback(
    (direction: 1 | -1) => {
      const nextFeedId = getAdjacentItemId(orderedFeedIds, latestSelectedFeedIdRef.current, direction);
      if (Result.isFailure(nextFeedId)) {
        return;
      }
      const resolvedNextFeedId = Result.unwrap(nextFeedId);
      latestSelectedFeedIdRef.current = resolvedNextFeedId;

      const nextFeedFolderId = getFeedFolderId(resolvedNextFeedId) ?? null;
      const latestExpandedFolderIds = latestExpandedFolderIdsRef.current;
      if (nextFeedFolderId && !latestExpandedFolderIds.has(nextFeedFolderId)) {
        const nextExpandedFolderIds = new Set([...latestExpandedFolderIds, nextFeedFolderId]);
        latestExpandedFolderIdsRef.current = nextExpandedFolderIds;
        setExpandedFolders(nextExpandedFolderIds);
      }

      selectFeed(resolvedNextFeedId);
      if (pendingFocusFrameRef.current !== null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
      }
      pendingFocusFrameRef.current = requestAnimationFrame(() => {
        pendingFocusFrameRef.current = null;
        if (!isMountedRef.current) {
          return;
        }

        const nextFeedButton = queryElementByDataAttribute<HTMLButtonElement>(
          document,
          "data-feed-id",
          resolvedNextFeedId,
        );
        if (!nextFeedButton) {
          return;
        }

        nextFeedButton.focus({ preventScroll: true });
        nextFeedButton.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      });
    },
    [getFeedFolderId, orderedFeedIds, selectFeed, setExpandedFolders],
  );

  useEffect(() => {
    const handler = createCustomEventDetailListener(isFeedNavigationDirection, (direction) => {
      navigateFeed(direction);
    });

    return bindWindowEvents([{ type: APP_EVENTS.navigateFeed, listener: handler }]);
  }, [navigateFeed]);
}
