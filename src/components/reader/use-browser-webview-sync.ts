import { Result } from "@praha/byethrow";
import { type Dispatch, type MutableRefObject, type RefObject, type SetStateAction, useCallback, useRef } from "react";
import {
  type AppError,
  type BrowserWebviewState,
  createOrUpdateBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import type { BrowserWebviewBounds } from "@/lib/browser-webview";
import { useUiStore } from "@/stores/ui-store";
import { isMissingEmbeddedBrowserWebviewError } from "./browser-webview-state";
import { resolveBrowserWebviewBounds, shouldApplySyncedBrowserState } from "./browser-webview-sync-helpers";

type UseBrowserWebviewSyncParams = {
  hostRef: RefObject<HTMLDivElement | null>;
  platformKind: string;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  captureLayoutDiagnostics: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onMissingEmbeddedBrowserWebview: (error: AppError) => void;
  showSurfaceFailure: (error: AppError) => void;
};

export function useBrowserWebviewSync({
  hostRef,
  platformKind,
  browserStateRef,
  captureLayoutDiagnostics,
  setBrowserState,
  onMissingEmbeddedBrowserWebview,
  showSurfaceFailure,
}: UseBrowserWebviewSyncParams) {
  const webviewCreatedRef = useRef(false);
  const createInFlightRef = useRef(false);
  const pendingBoundsRef = useRef<BrowserWebviewBounds | null>(null);

  const resetBrowserWebviewSyncState = useCallback(() => {
    webviewCreatedRef.current = false;
    createInFlightRef.current = false;
    pendingBoundsRef.current = null;
  }, []);

  const syncBrowserBounds = useCallback(
    async (bounds: BrowserWebviewBounds) => {
      const result = await setBrowserWebviewBounds(bounds);
      if (Result.isFailure(result)) {
        const error = Result.unwrapError(result);
        console.error("Failed to sync embedded browser bounds:", error);
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          resetBrowserWebviewSyncState();
          onMissingEmbeddedBrowserWebview(error);
        }
      }
    },
    [onMissingEmbeddedBrowserWebview, resetBrowserWebviewSyncState],
  );

  const flushPendingBounds = useCallback(
    async (requestedUrl: string) => {
      if (
        createInFlightRef.current ||
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
    [syncBrowserBounds],
  );

  const syncBrowserWebview = useCallback(
    async (requestedUrl: string, mode: "create" | "resize") => {
      const bounds = resolveBrowserWebviewBounds(hostRef, platformKind);
      if (!bounds) {
        return;
      }

      captureLayoutDiagnostics();

      if (mode === "resize") {
        if (createInFlightRef.current || !webviewCreatedRef.current) {
          pendingBoundsRef.current = bounds;
          return;
        }

        await syncBrowserBounds(bounds);
        return;
      }

      if (createInFlightRef.current) {
        pendingBoundsRef.current = bounds;
        return;
      }

      createInFlightRef.current = true;
      const result = await createOrUpdateBrowserWebview(requestedUrl, bounds);
      createInFlightRef.current = false;

      if (Result.isFailure(result)) {
        pendingBoundsRef.current = null;
        showSurfaceFailure(Result.unwrapError(result));
        return;
      }

      if (useUiStore.getState().browserUrl !== requestedUrl) {
        pendingBoundsRef.current = null;
        return;
      }

      webviewCreatedRef.current = true;
      const state = Result.unwrap(result);
      const previousState = browserStateRef.current;
      if (shouldApplySyncedBrowserState(previousState, requestedUrl, state)) {
        browserStateRef.current = state;
        setBrowserState(state);
      }

      await flushPendingBounds(requestedUrl);
    },
    [
      browserStateRef,
      captureLayoutDiagnostics,
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
  } as const;
}
