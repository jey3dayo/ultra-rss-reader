import { useCallback, useEffect, useRef } from "react";
import { cancelAnimationFrameHandle, scheduleAnimationFrame } from "@/lib/dom/animation-frame";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import { topLayerOwnsFocus } from "@/lib/dom/top-layer";
import { isReaderFocusTargetDisabled } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

type UseBrowserOverlayFocusReturnParams = {
  articleId: string;
  isBrowserOpen: boolean;
};

type UseBrowserOverlayFocusReturnResult = {
  focusSelectedArticleRow: () => void;
  rememberOverlayFocusReturnTarget: () => void;
};

const FOCUS_RETURN_SCHEDULE_WARNING = "Failed to schedule browser overlay focus return.";

export function useBrowserOverlayFocusReturn({
  articleId,
  isBrowserOpen,
}: UseBrowserOverlayFocusReturnParams): UseBrowserOverlayFocusReturnResult {
  const overlayFocusReturnTargetRef = useRef<HTMLElement | null>(null);
  const overlayFocusReturnTargetKeyRef = useRef<string | null>(null);
  const wasBrowserOpenRef = useRef(false);
  const focusReturnFrameRef = useRef<number | null>(null);

  const focusSelectedArticleRow = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const selectedArticleTarget = queryElementByDataAttribute<HTMLElement>(document, "data-article-id", articleId);
    if (!selectedArticleTarget || isReaderFocusTargetDisabled(selectedArticleTarget)) {
      return;
    }

    useUiStore.getState().setFocusedPane("list");
    selectedArticleTarget.focus({ preventScroll: true });
  }, [articleId]);

  const rememberOverlayFocusReturnTarget = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || activeElement === document.body) {
      return;
    }

    overlayFocusReturnTargetRef.current = activeElement;
    overlayFocusReturnTargetKeyRef.current = activeElement.getAttribute("data-browser-overlay-return-focus");
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (wasBrowserOpenRef.current && !isBrowserOpen && typeof document !== "undefined") {
      const previousTarget = overlayFocusReturnTargetRef.current;
      const previousTargetKey = overlayFocusReturnTargetKeyRef.current;
      overlayFocusReturnTargetRef.current = null;
      overlayFocusReturnTargetKeyRef.current = null;

      focusReturnFrameRef.current = scheduleAnimationFrame(
        () => {
          focusReturnFrameRef.current = null;
          if (cancelled) {
            return;
          }

          if (topLayerOwnsFocus()) {
            return;
          }

          if (previousTargetKey) {
            const nextTarget = queryElementByDataAttribute<HTMLElement>(
              document,
              "data-browser-overlay-return-focus",
              previousTargetKey,
            );
            if (nextTarget && !isReaderFocusTargetDisabled(nextTarget)) {
              nextTarget.focus();
              return;
            }
          }

          if (previousTarget?.isConnected && !isReaderFocusTargetDisabled(previousTarget)) {
            previousTarget.focus();
            return;
          }

          const selectedArticleTarget = queryElementByDataAttribute<HTMLElement>(
            document,
            "data-article-id",
            articleId,
          );
          if (selectedArticleTarget && !isReaderFocusTargetDisabled(selectedArticleTarget)) {
            useUiStore.getState().setFocusedPane("list");
            selectedArticleTarget.focus({ preventScroll: true });
            return;
          }

          const openInBrowserTarget = document.querySelector<HTMLElement>(
            '[data-browser-overlay-return-focus="open-in-browser"]',
          );
          if (openInBrowserTarget && !isReaderFocusTargetDisabled(openInBrowserTarget)) {
            openInBrowserTarget.focus();
            return;
          }

          const fallbackTarget = document.querySelector<HTMLElement>("[data-article-list-root='true']");
          if (fallbackTarget && !isReaderFocusTargetDisabled(fallbackTarget)) {
            useUiStore.getState().setFocusedPane("list");
            fallbackTarget.focus({ preventScroll: true });
          }
        },
        { warningMessage: FOCUS_RETURN_SCHEDULE_WARNING },
      );
    }

    wasBrowserOpenRef.current = isBrowserOpen;

    return () => {
      cancelled = true;
      if (focusReturnFrameRef.current !== null) {
        cancelAnimationFrameHandle(focusReturnFrameRef.current);
        focusReturnFrameRef.current = null;
      }
    };
  }, [articleId, isBrowserOpen]);

  return {
    focusSelectedArticleRow,
    rememberOverlayFocusReturnTarget,
  };
}
