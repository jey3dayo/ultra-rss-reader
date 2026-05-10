import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { BROWSER_OVERLAY_CLOSE_DELAY_MS } from "@/constants/motion";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

type UseArticleBrowserOverlayCloseParams = {
  closeBrowser: () => void;
  focusSelectedArticleRow: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setBrowserOverlayClosedPreference: () => void;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function waitForBrowserOverlayCloseMotion() {
  if (prefersReducedMotion()) {
    return { cancel: () => {}, done: Promise.resolve() };
  }

  let timeoutId: number | null = null;
  const done = new Promise<void>((resolve) => {
    try {
      timeoutId = window.setTimeout(resolve, BROWSER_OVERLAY_CLOSE_DELAY_MS);
    } catch (error) {
      console.warn("Failed to schedule browser overlay close motion timer.", error);
      resolve();
    }
  }).finally(() => {
    timeoutId = null;
  });

  return {
    cancel: () => {
      if (timeoutId === null) {
        return;
      }
      try {
        window.clearTimeout(timeoutId);
      } catch (error) {
        console.warn("Failed to clear browser overlay close motion timer.", error);
      }
      timeoutId = null;
    },
    done,
  };
}

export function useArticleBrowserOverlayClose({
  closeBrowser,
  focusSelectedArticleRow,
  setBrowserCloseInFlight,
  setBrowserOverlayClosedPreference,
}: UseArticleBrowserOverlayCloseParams) {
  const mountedRef = useRef(true);
  const closeGenerationRef = useRef(0);
  const closeMotionCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      closeGenerationRef.current += 1;
      closeMotionCancelRef.current?.();
      closeMotionCancelRef.current = null;
    };
  }, []);

  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRow();
    setBrowserOverlayClosedPreference();
    closeBrowser();
    scheduleReaderFocusFrame(() => {
      focusSelectedArticleRow();
      flushPendingBrowserCloseAction();
    });
  }, [closeBrowser, focusSelectedArticleRow, setBrowserOverlayClosedPreference]);

  return useCallback(() => {
    if (useUiStore.getState().browserCloseInFlight) {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }

    emitDebugInputTrace("close-browser start");
    setBrowserCloseInFlight(true);
    void closeBrowserWebview()
      .then((result) =>
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview before returning to reader mode:", error);
          }),
        ),
      )
      .catch((error: unknown) => {
        console.error("Embedded browser webview close command rejected before returning to reader mode:", error);
      })
      .finally(() => {
        emitDebugInputTrace("close-browser finalize");
        if (!mountedRef.current) {
          return;
        }
        const closeGeneration = closeGenerationRef.current + 1;
        closeGenerationRef.current = closeGeneration;
        closeMotionCancelRef.current?.();
        const closeMotion = waitForBrowserOverlayCloseMotion();
        closeMotionCancelRef.current = closeMotion.cancel;
        void closeMotion.done.then(() => {
          if (closeGenerationRef.current !== closeGeneration) {
            return;
          }
          closeMotionCancelRef.current = null;
          finalizeCloseBrowserOverlay();
        });
      });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);
}
