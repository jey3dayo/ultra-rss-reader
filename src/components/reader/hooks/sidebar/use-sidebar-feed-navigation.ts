import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { APP_EVENTS } from "@/constants/events";
import { getAdjacentItemId } from "@/lib/articles/article-list";
import { cancelAnimationFrameHandle, scheduleAnimationFrame } from "@/lib/dom/animation-frame";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  isWindowNavigationDirection,
} from "@/lib/window/window-events";
import type { SidebarFeedNavigationParams } from "../../sidebar-feed-section.types";

const FEED_FOCUS_SCHEDULE_WARNING = "Failed to schedule sidebar feed focus.";

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
  const pendingFocusFeedIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const cancelPendingFocusFrame = useCallback(() => {
    if (pendingFocusFrameRef.current !== null) {
      cancelAnimationFrameHandle(pendingFocusFrameRef.current);
      pendingFocusFrameRef.current = null;
      pendingFocusFeedIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    latestExpandedFolderIdsRef.current = expandedFolderIds;
  }, [expandedFolderIds]);

  useEffect(() => {
    latestSelectedFeedIdRef.current = selectedFeedId;
    if (pendingFocusFeedIdRef.current !== null && pendingFocusFeedIdRef.current !== selectedFeedId) {
      cancelPendingFocusFrame();
    }
  }, [cancelPendingFocusFrame, selectedFeedId]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelPendingFocusFrame();
    };
  }, [cancelPendingFocusFrame]);

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
      cancelPendingFocusFrame();
      pendingFocusFeedIdRef.current = resolvedNextFeedId;
      const pendingFocusFrame = scheduleAnimationFrame(
        () => {
          pendingFocusFrameRef.current = null;
          pendingFocusFeedIdRef.current = null;
          if (!isMountedRef.current) {
            return;
          }
          if (latestSelectedFeedIdRef.current !== resolvedNextFeedId) {
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
        },
        { warningMessage: FEED_FOCUS_SCHEDULE_WARNING },
      );
      pendingFocusFrameRef.current = pendingFocusFrame;
      if (pendingFocusFrame === null) {
        pendingFocusFeedIdRef.current = null;
      }
    },
    [cancelPendingFocusFrame, getFeedFolderId, orderedFeedIds, selectFeed, setExpandedFolders],
  );

  useEffect(() => {
    const handler = createCustomEventDetailListener(isWindowNavigationDirection, (direction) => {
      navigateFeed(direction);
    });

    return bindWindowEvents([{ type: APP_EVENTS.navigateFeed, listener: handler }]);
  }, [navigateFeed]);
}
