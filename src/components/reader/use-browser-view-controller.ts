import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "./browser-overlay-presentation";
import { isBrowserRuntimeUnavailable } from "./browser-runtime-availability";
import { type BrowserSurfaceIssue, createBrowserSurfaceFallback } from "./browser-surface-issue";
import { type BrowserWebviewFallbackPayload, initialBrowserState, mergeBrowserState } from "./browser-webview-state";
import { useBrowserDebugGeometryEvents } from "./use-browser-debug-geometry-events";
import { useBrowserLayoutDiagnostics } from "./use-browser-layout-diagnostics";
import { useBrowserOverlayShortcuts } from "./use-browser-overlay-shortcuts";
import { useBrowserOverlayViewportWidth } from "./use-browser-overlay-viewport-width";
import { useBrowserViewActions } from "./use-browser-view-actions";
import { useBrowserViewSurfaceState } from "./use-browser-view-surface-state";
import { useBrowserWebviewBoundsSync } from "./use-browser-webview-bounds-sync";
import { useBrowserWebviewCleanup } from "./use-browser-webview-cleanup";
import { useBrowserWebviewEvents } from "./use-browser-webview-events";
import { useBrowserWebviewLoadTimeout } from "./use-browser-webview-load-timeout";
import { useBrowserWebviewSync } from "./use-browser-webview-sync";

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
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserWebviewDiagnosticsPayload | null>(null);
  const viewportWidth = useBrowserOverlayViewportWidth();
  const isLoading = browserUrl ? (browserState?.is_loading ?? true) : false;

  const handleCloseOverlay = useCallback(() => {
    onCloseOverlay();
  }, [onCloseOverlay]);

  const { layoutDiagnostics, captureLayoutDiagnostics } = useBrowserLayoutDiagnostics({
    browserUrl,
    showDiagnostics,
    overlayRef,
    stageRef,
    hostRef,
  });
  const runtimeUnavailable = isBrowserRuntimeUnavailable();
  const { setSurfaceIssue, handleLostEmbeddedBrowserWebview, showSurfaceFailure, activeSurfaceIssue } =
    useBrowserViewSurfaceState({
      browserStateRef,
      fallbackInFlightRef,
      isLoading,
      runtimeUnavailable,
      onCloseOverlay: handleCloseOverlay,
      setBrowserState,
      browserMode: t("browser_embed_browser_mode"),
      browserModeHint: t("browser_embed_browser_mode_hint"),
      failed: t("browser_embed_failed"),
      failedHint: t("browser_embed_failed_hint"),
    });

  const waitForBrowserWebviewListeners = useBrowserWebviewEvents({
    showDiagnostics,
    onStateChanged: useCallback(
      (payload: BrowserWebviewState) => {
        const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
        browserStateRef.current = nextState;
        setBrowserState(nextState);
        setSurfaceIssue(null);
        fallbackInFlightRef.current = false;
      },
      [setSurfaceIssue],
    ),
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
      [setSurfaceIssue, t],
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

  const { resetBrowserWebviewSyncState, syncBrowserWebview } = useBrowserWebviewSync({
    hostRef,
    platformKind,
    browserStateRef,
    captureLayoutDiagnostics,
    setBrowserState,
    onMissingEmbeddedBrowserWebview: handleLostEmbeddedBrowserWebview,
    showSurfaceFailure,
  });

  useEffect(() => {
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();

    if (!browserUrl) return undefined;

    setBrowserState((state) => {
      const nextState = state?.url === browserUrl ? state : initialBrowserState(browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });
    setSurfaceIssue(null);
  }, [browserUrl, resetBrowserWebviewSyncState, setSurfaceIssue]);

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

  useBrowserWebviewLoadTimeout({
    browserUrl,
    isLoading,
    isStillLoading: () => Boolean(browserStateRef.current?.is_loading),
    showSurfaceFailure,
  });

  useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay });

  const { handleRetry, handleOpenExternal } = useBrowserViewActions({
    browserUrl,
    browserStateRef,
    setBrowserState,
    resetBrowserWebviewSyncState,
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
