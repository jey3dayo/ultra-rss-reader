import { Result } from "@praha/byethrow";
import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import { useCallback, useRef } from "react";
import type { PlatformInfo } from "@/api/schemas";
import {
  type AppError,
  type BrowserWebviewState,
  createOrUpdateBrowserWebview,
  focusBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";
import { useUiStore } from "@/stores/ui-store";
import {
  isMissingEmbeddedBrowserWebviewError,
  setBrowserStateWithRef,
} from "../../browser-webview-state";
import {
  resolveBrowserWebviewBounds,
  shouldApplySyncedBrowserState,
} from "../../browser-webview-sync-helpers";
import { useAsyncCommandLifecycle } from "./use-browser-url-effect";

const BROWSER_WEBVIEW_OPERATION_FAILED_MESSAGE =
  "Webプレビューの操作に失敗しました。再試行してください。";

type UseBrowserWebviewSyncParams = {
  hostRef: RefObject<HTMLDivElement | null>;
  platformKind: PlatformInfo["kind"];
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  captureLayoutDiagnostics: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onMissingEmbeddedBrowserWebview: (error: AppError) => void;
  showSurfaceFailure: (error: AppError) => void;
};

type UseBrowserWebviewSyncResult = {
  resetBrowserWebviewSyncState: () => void;
  syncBrowserWebview: (
    requestedUrl: string,
    mode: "create" | "resize",
  ) => Promise<void>;
};

type BrowserWebviewOperationFailure = {
  kind: "browser-webview-operation-failure";
  error: AppError;
};

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    (error.type === "UserVisible" || error.type === "Retryable") &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  );
}

function toBrowserWebviewOperationFailure(
  error: unknown,
): BrowserWebviewOperationFailure {
  return {
    kind: "browser-webview-operation-failure",
    error: isAppError(error)
      ? error
      : {
          type: "UserVisible",
          message: BROWSER_WEBVIEW_OPERATION_FAILED_MESSAGE,
        },
  };
}

function isBrowserWebviewOperationFailure(
  result: unknown,
): result is BrowserWebviewOperationFailure {
  return (
    typeof result === "object" &&
    result !== null &&
    "kind" in result &&
    result.kind === "browser-webview-operation-failure" &&
    "error" in result &&
    isAppError(result.error)
  );
}

export function useBrowserWebviewSync({
  hostRef,
  platformKind,
  browserStateRef,
  captureLayoutDiagnostics,
  setBrowserState,
  onMissingEmbeddedBrowserWebview,
  showSurfaceFailure,
}: UseBrowserWebviewSyncParams): UseBrowserWebviewSyncResult {
  const webviewCreatedRef = useRef(false);
  const createLifecycle = useAsyncCommandLifecycle();
  const resizeInFlightRef = useRef(false);
  const pendingBoundsRef = useRef<BrowserWebviewBounds | null>(null);

  const resetBrowserWebviewSyncState = useCallback(() => {
    webviewCreatedRef.current = false;
    createLifecycle.reset();
    resizeInFlightRef.current = false;
    pendingBoundsRef.current = null;
  }, [createLifecycle]);

  const syncBrowserBounds = useCallback(
    async (bounds: BrowserWebviewBounds) => {
      if (resizeInFlightRef.current) {
        pendingBoundsRef.current = bounds;
        return;
      }

      resizeInFlightRef.current = true;
      let nextBounds: BrowserWebviewBounds | null = bounds;
      while (nextBounds) {
        const result = await setBrowserWebviewBounds(nextBounds).catch(
          toBrowserWebviewOperationFailure,
        );
        if (isBrowserWebviewOperationFailure(result)) {
          resizeInFlightRef.current = false;
          console.error(
            "Failed to sync embedded browser bounds:",
            result.error,
          );
          showSurfaceFailure(result.error);
          return;
        }
        if (Result.isFailure(result)) {
          resizeInFlightRef.current = false;
          const error = Result.unwrapError(result);
          console.error("Failed to sync embedded browser bounds:", error);
          if (isMissingEmbeddedBrowserWebviewError(error)) {
            resetBrowserWebviewSyncState();
            onMissingEmbeddedBrowserWebview(error);
            return;
          }
          showSurfaceFailure(error);
          return;
        }

        nextBounds = pendingBoundsRef.current;
        pendingBoundsRef.current = null;
      }

      resizeInFlightRef.current = false;
    },
    [
      onMissingEmbeddedBrowserWebview,
      resetBrowserWebviewSyncState,
      showSurfaceFailure,
    ],
  );

  const flushPendingBounds = useCallback(
    async (requestedUrl: string) => {
      if (
        createLifecycle.isInFlight() ||
        !webviewCreatedRef.current ||
        useUiStore.getState().browserUrl !== requestedUrl
      ) {
        return;
      }

      const pendingBounds = pendingBoundsRef.current;
      if (!pendingBounds) {
        return;
      }

      pendingBoundsRef.current = null;
      await syncBrowserBounds(pendingBounds);
    },
    [createLifecycle, syncBrowserBounds],
  );

  const syncBrowserWebview = useCallback(
    async (requestedUrl: string, mode: "create" | "resize") => {
      const bounds = resolveBrowserWebviewBounds(hostRef, platformKind);
      if (!bounds) {
        return;
      }

      captureLayoutDiagnostics();

      if (mode === "resize") {
        if (createLifecycle.isInFlight() || !webviewCreatedRef.current) {
          pendingBoundsRef.current = bounds;
          return;
        }

        await syncBrowserBounds(bounds);
        return;
      }

      if (createLifecycle.isInFlight()) {
        pendingBoundsRef.current = bounds;
        return;
      }

      const createRun = createLifecycle.start();
      const result = await createOrUpdateBrowserWebview(
        requestedUrl,
        bounds,
      ).catch(toBrowserWebviewOperationFailure);
      createRun.finish();

      if (isBrowserWebviewOperationFailure(result)) {
        pendingBoundsRef.current = null;
        console.error(
          "Failed to create embedded browser webview:",
          result.error,
        );
        showSurfaceFailure(result.error);
        return;
      }

      if (Result.isFailure(result)) {
        pendingBoundsRef.current = null;
        showSurfaceFailure(Result.unwrapError(result));
        return;
      }

      if (
        !createRun.isLatest() ||
        useUiStore.getState().browserUrl !== requestedUrl
      ) {
        pendingBoundsRef.current = null;
        return;
      }

      webviewCreatedRef.current = true;
      const state = Result.unwrap(result);
      const previousState = browserStateRef.current;
      if (shouldApplySyncedBrowserState(previousState, requestedUrl, state)) {
        setBrowserStateWithRef(browserStateRef, setBrowserState, state);
      }

      const focusResult = await focusBrowserWebview().catch(
        toBrowserWebviewOperationFailure,
      );
      if (isBrowserWebviewOperationFailure(focusResult)) {
        console.error(
          "Failed to focus embedded browser after create:",
          focusResult.error,
        );
        showSurfaceFailure(focusResult.error);
        return;
      }
      if (Result.isFailure(focusResult)) {
        const error = Result.unwrapError(focusResult);
        console.error("Failed to focus embedded browser after create:", error);
        showSurfaceFailure(error);
      }

      await flushPendingBounds(requestedUrl);
    },
    [
      browserStateRef,
      captureLayoutDiagnostics,
      createLifecycle,
      flushPendingBounds,
      hostRef,
      platformKind,
      setBrowserState,
      showSurfaceFailure,
      syncBrowserBounds,
    ],
  );

  return {
    resetBrowserWebviewSyncState,
    syncBrowserWebview,
  };
}
