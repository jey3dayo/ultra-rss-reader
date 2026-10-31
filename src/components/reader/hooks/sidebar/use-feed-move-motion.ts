import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { readMatchMedia } from "@/lib/runtime/match-media-listener";
import {
  captureFeedMoveSnapshot,
  type FeedMoveMotionSession,
  watchFeedMoveAnimation,
} from "@/lib/sidebar/feed-move-animation";

type UseFeedMoveMotionParams = {
  containerRef: RefObject<HTMLElement | null>;
  scopeKey: string;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
};

type UseFeedMoveMotionResult = Pick<UseFeedMoveMotionParams, "moveFeedToFolder" | "moveFeedToUnfoldered">;

function useKeyboardInputTracker() {
  const lastInputWasKeyboardRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        lastInputWasKeyboardRef.current = true;
      }
    };
    const handlePointerDown = () => {
      lastInputWasKeyboardRef.current = false;
    };
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  return lastInputWasKeyboardRef;
}

export function useFeedMoveMotion({
  containerRef,
  scopeKey,
  moveFeedToFolder,
  moveFeedToUnfoldered,
}: UseFeedMoveMotionParams): UseFeedMoveMotionResult {
  const sessionRef = useRef<FeedMoveMotionSession | null>(null);
  const sessionScopeKeyRef = useRef(scopeKey);
  const scopeKeyRef = useRef(scopeKey);
  const lastInputWasKeyboardRef = useKeyboardInputTracker();

  const stopSession = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  useEffect(() => stopSession, [stopSession]);

  useLayoutEffect(() => {
    scopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  useEffect(() => {
    if (sessionScopeKeyRef.current !== scopeKey) {
      stopSession();
    }
  }, [scopeKey, stopSession]);

  const moveWithMotion = useCallback(
    async (feedId: string, destinationFolderId: string | null, move: () => Promise<unknown>) => {
      stopSession();
      const snapshot = lastInputWasKeyboardRef.current
        ? null
        : captureFeedMoveSnapshot({
            container: containerRef.current,
            feedId,
            destinationFolderId,
            scopeKey: scopeKeyRef.current,
            now: Date.now(),
          });
      const session = snapshot
        ? watchFeedMoveAnimation({
            container: containerRef.current,
            snapshot,
            getScopeKey: () => scopeKeyRef.current,
            reducedMotion: readMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false,
          })
        : null;
      sessionRef.current = session;
      sessionScopeKeyRef.current = scopeKeyRef.current;

      try {
        return await move();
      } catch (error) {
        session?.stop();
        if (sessionRef.current === session) {
          sessionRef.current = null;
        }
        throw error;
      }
    },
    [containerRef, lastInputWasKeyboardRef, stopSession],
  );

  const moveFeedToFolderWithMotion = useCallback(
    (feedId: string, folderId: string) => moveWithMotion(feedId, folderId, () => moveFeedToFolder(feedId, folderId)),
    [moveFeedToFolder, moveWithMotion],
  );
  const moveFeedToUnfolderedWithMotion = useCallback(
    (feedId: string) => moveWithMotion(feedId, null, () => moveFeedToUnfoldered(feedId)),
    [moveFeedToUnfoldered, moveWithMotion],
  );

  return { moveFeedToFolder: moveFeedToFolderWithMotion, moveFeedToUnfoldered: moveFeedToUnfolderedWithMotion };
}
