import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AppError,
  type BrowserWebviewState,
  createOrUpdateBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";
import { hasTauriRuntime } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "./browser-overlay-presentation";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "./browser-surface-issue";
import {
  type BrowserWebviewFallbackPayload,
  initialBrowserState,
  isMissingEmbeddedBrowserWebviewError,
  mergeBrowserState,
} from "./browser-webview-state";
import { useBrowserDebugGeometryEvents } from "./use-browser-debug-geometry-events";
import { useBrowserLayoutDiagnostics } from "./use-browser-layout-diagnostics";
import { useBrowserOverlayShortcuts } from "./use-browser-overlay-shortcuts";
import { useBrowserOverlayViewportWidth } from "./use-browser-overlay-viewport-width";
import { useBrowserViewActions } from "./use-browser-view-actions";
import { useBrowserWebviewBoundsSync } from "./use-browser-webview-bounds-sync";
import { useBrowserWebviewCleanup } from "./use-browser-webview-cleanup";
import { useBrowserWebviewEvents } from "./use-browser-webview-events";
import { useBrowserWebviewLoadTimeout } from "./use-browser-webview-load-timeout";

type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;

type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;

type BrowserViewGeometry = ReturnType<typeof resolveBrowserViewerGeometry>;

export type BrowserViewController = {
  browserUrl: string | null;
  showDiagnostics: boolean;
  geometry: BrowserViewGeometry;
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
  isLoading: boolean;
  handleCloseOverlay: () => void;
  handleRetry: () => void;
  handleOpenExternal: () => Promise<void>;
  closeButtonClass: string;
  actionButtonClass: string;
  stageClass: string;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
};

export function useBrowserViewController({
  scope,
  onCloseOverlay,
}: {
  scope: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
}): BrowserViewController {
  const prefs = usePreferencesStore((s) => s.prefs);
  const { t } = useTranslation("reader");
  const showDiagnostics = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const browserUrl = useUiStore((s) => s.browserUrl);
  const showToast = useUiStore((s) => s.showToast);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const browserStateRef = useRef<BrowserWebviewState | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fallbackInFlightRef = useRef(false);
  const webviewCreatedRef = useRef(false);
  const createInFlightRef = useRef(false);
  const pendingBoundsRef = useRef<BrowserWebviewBounds | null>(null);
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserWebviewDiagnosticsPayload | null>(null);
  const [surfaceIssue, setSurfaceIssue] = useState<BrowserSurfaceIssue | null>(null);
  const viewportWidth = useBrowserOverlayViewportWidth();

  const handleCloseOverlay = useCallback(() => {
    onCloseOverlay();
  }, [onCloseOverlay]);

  const handleLostEmbeddedBrowserWebview = useCallback(
    (error: AppError) => {
      console.warn("Embedded browser webview disappeared while overlay was open:", error.message);
      fallbackInFlightRef.current = false;
      webviewCreatedRef.current = false;
      createInFlightRef.current = false;
      pendingBoundsRef.current = null;
      browserStateRef.current = null;
      setBrowserState(null);
      setSurfaceIssue(null);
      handleCloseOverlay();
    },
    [handleCloseOverlay],
  );

  const { layoutDiagnostics, captureLayoutDiagnostics } = useBrowserLayoutDiagnostics({
    browserUrl,
    showDiagnostics,
    overlayRef,
    stageRef,
    hostRef,
  });

  const showSurfaceFailure = useCallback(
    (error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open embedded browser webview:", error);
      setSurfaceIssue(
        createBrowserSurfaceFailure(error.message, {
          failed: t("browser_embed_failed"),
          failedHint: t("browser_embed_failed_hint"),
        }),
      );
      setBrowserState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        const nextState = { ...currentState, is_loading: false };
        browserStateRef.current = nextState;
        return nextState;
      });
    },
    [t],
  );

  const waitForBrowserWebviewListeners = useBrowserWebviewEvents({
    showDiagnostics,
    onStateChanged: useCallback((payload: BrowserWebviewState) => {
      const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
      browserStateRef.current = nextState;
      setBrowserState(nextState);
      setSurfaceIssue(null);
      fallbackInFlightRef.current = false;
    }, []),
    onFallback: useCallback(
      (payload: BrowserWebviewFallbackPayload) => {
        setSurfaceIssue(
          createBrowserSurfaceFallback(payload.error_message, {
            failed: t("browser_embed_failed"),
            failedHint: t("browser_embed_failed_hint"),
            blocked: t("browser_embed_blocked"),
            blockedHint: t("browser_embed_blocked_hint"),
          }),
        );
        setBrowserState((currentState) => {
          if (!currentState) {
            return currentState;
          }
          const nextState = { ...currentState, is_loading: false };
          browserStateRef.current = nextState;
          return nextState;
        });
      },
      [t],
    ),
    onClosed: handleCloseOverlay,
    onDiagnostics: useCallback((payload: BrowserWebviewDiagnosticsPayload) => {
      setNativeDiagnostics(payload);
    }, []),
  });

  useBrowserDebugGeometryEvents({
    showDiagnostics,
    layoutDiagnostics,
    nativeDiagnostics,
  });

  const syncBrowserBounds = useCallback(
    async (bounds: BrowserWebviewBounds) => {
      const result = await setBrowserWebviewBounds(bounds);
      if (Result.isFailure(result)) {
        const error = Result.unwrapError(result);
        console.error("Failed to sync embedded browser bounds:", error);
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          handleLostEmbeddedBrowserWebview(error);
        }
      }
    },
    [handleLostEmbeddedBrowserWebview],
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
      const rect = hostRef.current?.getBoundingClientRect();
      const usePhysicalBounds = platformKind === "windows";
      const bounds = rect
        ? toBrowserWebviewBounds(rect, {
            unit: usePhysicalBounds ? "physical" : "logical",
          })
        : null;
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
      if (!previousState || (previousState.url === requestedUrl && (previousState.is_loading || !state.is_loading))) {
        browserStateRef.current = state;
        setBrowserState(state);
      }

      await flushPendingBounds(requestedUrl);
    },
    [browserStateRef, captureLayoutDiagnostics, flushPendingBounds, hostRef, platformKind, showSurfaceFailure, syncBrowserBounds],
  );

  useEffect(() => {
    fallbackInFlightRef.current = false;
    webviewCreatedRef.current = false;
    createInFlightRef.current = false;
    pendingBoundsRef.current = null;

    if (!browserUrl) return undefined;

    setBrowserState((state) => {
      const nextState = state?.url === browserUrl ? state : initialBrowserState(browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });
    setSurfaceIssue(null);
  }, [browserUrl]);

  useBrowserWebviewBoundsSync({
    browserUrl,
    hostRef,
    waitForBrowserWebviewListeners,
    syncBrowserWebview,
  });

  useEffect(() => {
    if (showDiagnostics) {
      return;
    }

    setNativeDiagnostics(null);
  }, [showDiagnostics]);

  useBrowserWebviewCleanup();

  const isLoading = browserUrl ? (browserState?.is_loading ?? true) : false;

  useBrowserWebviewLoadTimeout({
    browserUrl,
    isLoading,
    isStillLoading: () => Boolean(browserStateRef.current?.is_loading),
    showSurfaceFailure,
  });

  useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay });

  const runtimeUnavailable =
    (typeof window !== "undefined" &&
      (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)) ||
    !hasTauriRuntime();
  const activeSurfaceIssue =
    surfaceIssue ??
    resolveRuntimeUnavailableSurfaceIssue({
      runtimeUnavailable,
      isLoading,
      labels: {
        browserMode: t("browser_embed_browser_mode"),
        browserModeHint: t("browser_embed_browser_mode_hint"),
      },
    });

  const { handleRetry, handleOpenExternal } = useBrowserViewActions({
    browserUrl,
    browserStateRef,
    setBrowserState,
    resetBrowserWebviewSyncState: () => {
      webviewCreatedRef.current = false;
      createInFlightRef.current = false;
      pendingBoundsRef.current = null;
    },
    setSurfaceIssue,
    showToast,
    syncBrowserWebview,
    initialBrowserState,
    fallbackInFlightRef,
  });

  const geometry = useMemo(
    () =>
      resolveBrowserViewerGeometry({
        scope,
        viewportWidth,
        diagnosticsVisible: showDiagnostics,
      }),
    [scope, showDiagnostics, viewportWidth],
  );
  const isCompactViewer = geometry.compact;
  const closeButtonClass = getBrowserOverlayCloseButtonClass(isCompactViewer);
  const actionButtonClass = getBrowserOverlayActionButtonClass(isCompactViewer);
  const stageClass = getBrowserOverlayStageClass(scope);

  return {
    browserUrl,
    showDiagnostics,
    geometry,
    layoutDiagnostics,
    nativeDiagnostics,
    activeSurfaceIssue,
    isLoading,
    handleCloseOverlay,
    handleRetry,
    handleOpenExternal,
    closeButtonClass,
    actionButtonClass,
    stageClass,
    hostRef,
    overlayRef,
    stageRef,
  } as const;
}
