import { useCallback, useEffect, useRef } from "react";
import { useUiStore } from "@/stores/ui-store";
import type { UseBrowserOverlayFocusReturnParams } from "./browser-view.types";

export function useBrowserOverlayFocusReturn({ articleId, isBrowserOpen }: UseBrowserOverlayFocusReturnParams) {
  const overlayFocusReturnTargetRef = useRef<HTMLElement | null>(null);
  const overlayFocusReturnTargetKeyRef = useRef<string | null>(null);
  const wasBrowserOpenRef = useRef(false);

  const focusSelectedArticleRow = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);
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
    if (wasBrowserOpenRef.current && !isBrowserOpen && typeof document !== "undefined") {
      const previousTarget = overlayFocusReturnTargetRef.current;
      const previousTargetKey = overlayFocusReturnTargetKeyRef.current;
      overlayFocusReturnTargetRef.current = null;
      overlayFocusReturnTargetKeyRef.current = null;

      requestAnimationFrame(() => {
        const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${articleId}"]`);
        if (selectedArticleTarget && !selectedArticleTarget.hasAttribute("disabled")) {
          useUiStore.getState().setFocusedPane("list");
          selectedArticleTarget.focus({ preventScroll: true });
          return;
        }

        if (previousTargetKey) {
          const nextTarget = document.querySelector<HTMLElement>(
            `[data-browser-overlay-return-focus="${previousTargetKey}"]`,
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

        document.querySelector<HTMLElement>('[data-browser-overlay-return-focus="open-in-browser"]')?.focus();
      });
    }

    wasBrowserOpenRef.current = isBrowserOpen;
  }, [articleId, isBrowserOpen]);

  return {
    focusSelectedArticleRow,
    rememberOverlayFocusReturnTarget,
  } as const;
}
