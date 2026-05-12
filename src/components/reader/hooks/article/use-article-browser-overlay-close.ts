import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { BROWSER_OVERLAY_CLOSE_DELAY_MS } from "@/constants/motion";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

const BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS = 2_000;

type UseArticleBrowserOverlayCloseParams = {
  closeBrowser: () => void;
  focusSelectedArticleRow: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setBrowserOverlayClosedPreference: () => void;
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (error) {
    console.warn("Failed to read reduced motion preference for browser overlay close.", error);
    return false;
  }
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

function focusSelectedArticleRowAfterClose(focusSelectedArticleRow: () => void): void {
  try {
    focusSelectedArticleRow();
  } catch (error) {
    console.warn("Failed to restore article row focus after closing browser overlay.", error);
  }
}

async function closeBrowserWebviewBeforeReaderMode(): Promise<void> {
  let timeoutId: number | null = null;
  const closeCommand = closeBrowserWebview()
    .then((result) => {
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.error("Failed to close embedded browser webview before returning to reader mode:", error);
        }),
      );
      return "closed" as const;
    })
    .catch((error: unknown) => {
      console.error("Embedded browser webview close command rejected before returning to reader mode:", error);
      return "closed" as const;
    });

  const timeout = new Promise<"timeout">((resolve) => {
    try {
      timeoutId = window.setTimeout(() => resolve("timeout"), BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS);
    } catch (error) {
      console.warn("Failed to schedule embedded browser webview close timeout.", error);
      resolve("timeout");
    }
  });

  const result = await Promise.race([closeCommand, timeout]);
  if (timeoutId !== null) {
    try {
      window.clearTimeout(timeoutId);
    } catch (error) {
      console.warn("Failed to clear embedded browser webview close timeout.", error);
    }
  }
  if (result === "timeout") {
    console.warn("Timed out closing embedded browser webview before returning to reader mode.");
  }
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
  const closeInFlightByHookRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      closeGenerationRef.current += 1;
      closeMotionCancelRef.current?.();
      closeMotionCancelRef.current = null;
      if (closeInFlightByHookRef.current && useUiStore.getState().browserCloseInFlight) {
        setBrowserCloseInFlight(false);
      }
    };
  }, [setBrowserCloseInFlight]);

  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRowAfterClose(focusSelectedArticleRow);
    setBrowserOverlayClosedPreference();
    closeBrowser();
    scheduleReaderFocusFrame(() => {
      try {
        focusSelectedArticleRowAfterClose(focusSelectedArticleRow);
      } finally {
        flushPendingBrowserCloseAction();
      }
    });
  }, [closeBrowser, focusSelectedArticleRow, setBrowserOverlayClosedPreference]);

  return useCallback(() => {
    if (useUiStore.getState().browserCloseInFlight) {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }

    emitDebugInputTrace("close-browser start");
    closeInFlightByHookRef.current = true;
    setBrowserCloseInFlight(true);
    void closeBrowserWebviewBeforeReaderMode().finally(() => {
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
        closeInFlightByHookRef.current = false;
        finalizeCloseBrowserOverlay();
      });
    });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);
}
