import { useCallback, useEffect, useRef } from "react";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";
import { useUiStore } from "@/stores/ui-store";

type UseBrowserOverlayFocusReturnParams = {
  articleId: string;
  isBrowserOpen: boolean;
};

type UseBrowserOverlayFocusReturnResult = {
  focusSelectedArticleRow: () => void;
  rememberOverlayFocusReturnTarget: () => void;
};

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
    if (!selectedArticleTarget || selectedArticleTarget.hasAttribute("disabled")) {
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

      focusReturnFrameRef.current = requestAnimationFrame(() => {
        focusReturnFrameRef.current = null;
        if (cancelled) {
          return;
        }

        const selectedArticleTarget = queryElementByDataAttribute<HTMLElement>(document, "data-article-id", articleId);
        if (selectedArticleTarget && !selectedArticleTarget.hasAttribute("disabled")) {
          useUiStore.getState().setFocusedPane("list");
          selectedArticleTarget.focus({ preventScroll: true });
          return;
        }

        if (previousTargetKey) {
          const nextTarget = queryElementByDataAttribute<HTMLElement>(
            document,
            "data-browser-overlay-return-focus",
            previousTargetKey,
          );
          if (nextTarget && !nextTarget.hasAttribute("disabled")) {
            nextTarget.focus();
            return;
          }
        }

        if (previousTarget?.isConnected && !previousTarget.hasAttribute("disabled")) {
          previousTarget.focus();
          return;
        }

        const openInBrowserTarget = document.querySelector<HTMLElement>(
          '[data-browser-overlay-return-focus="open-in-browser"]',
        );
        if (openInBrowserTarget && !openInBrowserTarget.hasAttribute("disabled")) {
          openInBrowserTarget.focus();
          return;
        }

        const fallbackTarget = document.querySelector<HTMLElement>("[data-article-list-root='true']");
        if (fallbackTarget && !fallbackTarget.hasAttribute("disabled")) {
          useUiStore.getState().setFocusedPane("list");
          fallbackTarget.focus({ preventScroll: true });
        }
      });
    }

    wasBrowserOpenRef.current = isBrowserOpen;

    return () => {
      cancelled = true;
      if (focusReturnFrameRef.current !== null) {
        cancelAnimationFrame(focusReturnFrameRef.current);
        focusReturnFrameRef.current = null;
      }
    };
  }, [articleId, isBrowserOpen]);

  return {
    focusSelectedArticleRow,
    rememberOverlayFocusReturnTarget,
  };
}
