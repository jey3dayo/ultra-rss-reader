import { useMemo } from "react";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import type { BrowserViewController, UseBrowserViewControllerParams } from "./browser-view.types";
import { resolveBrowserViewPresentation } from "./browser-view-presentation";
import { initialBrowserState } from "./browser-webview-state";
import { useBrowserDebugGeometryEvents } from "./use-browser-debug-geometry-events";
import { useBrowserLayoutDiagnostics } from "./use-browser-layout-diagnostics";
import { useBrowserOverlayShortcuts } from "./use-browser-overlay-shortcuts";
import { useBrowserViewActions } from "./use-browser-view-actions";
import { useBrowserViewEventBridge } from "./use-browser-view-event-bridge";
import { useBrowserViewRuntime } from "./use-browser-view-runtime";
import { useBrowserWebviewBoundsSync } from "./use-browser-webview-bounds-sync";
import { useBrowserWebviewCleanup } from "./use-browser-webview-cleanup";
import { useBrowserWebviewLoadTimeout } from "./use-browser-webview-load-timeout";
import { useBrowserWebviewRequestState } from "./use-browser-webview-request-state";
import { useBrowserWebviewSync } from "./use-browser-webview-sync";

export function useBrowserViewController({
  scope,
  onCloseOverlay,
}: UseBrowserViewControllerParams): BrowserViewController {
  const {
    showDiagnostics,
    browserUrl,
    showToast,
    platformKind,
    setBrowserState,
    browserStateRef,
    hostRef,
    overlayRef,
    stageRef,
    fallbackInFlightRef,
    nativeDiagnostics,
    handleNativeDiagnostics,
    viewportWidth,
    isLoading,
    handleCloseOverlay,
  } = useBrowserViewRuntime({ onCloseOverlay });
  const overlayTitlebar = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  const { layoutDiagnostics, captureLayoutDiagnostics } = useBrowserLayoutDiagnostics({
    browserUrl,
    showDiagnostics,
    overlayRef,
    stageRef,
    hostRef,
  });
  const {
    setSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    showSurfaceFailure,
    activeSurfaceIssue,
    waitForBrowserWebviewListeners,
  } = useBrowserViewEventBridge({
    showDiagnostics,
    isLoading,
    browserStateRef,
    fallbackInFlightRef,
    setBrowserState,
    onCloseOverlay: handleCloseOverlay,
    onDiagnostics: handleNativeDiagnostics,
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

  useBrowserWebviewRequestState({
    browserUrl,
    browserStateRef,
    fallbackInFlightRef,
    resetBrowserWebviewSyncState,
    setBrowserState,
    setSurfaceIssue,
  });

  useBrowserWebviewBoundsSync({
    browserUrl,
    hostRef,
    waitForBrowserWebviewListeners,
    syncBrowserWebview,
  });

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

  const presentation = useMemo(
    () =>
      resolveBrowserViewPresentation({
        scope,
        viewportWidth,
        diagnosticsVisible: showDiagnostics,
        overlayTitlebar,
      }),
    [overlayTitlebar, scope, showDiagnostics, viewportWidth],
  );

  return {
    browserUrl,
    showDiagnostics,
    geometry: presentation.geometry,
    layoutDiagnostics,
    nativeDiagnostics,
    activeSurfaceIssue,
    isLoading,
    handleCloseOverlay,
    handleRetry,
    handleOpenExternal,
    closeButtonClass: presentation.closeButtonClass,
    actionButtonClass: presentation.actionButtonClass,
    stageClass: presentation.stageClass,
    hostRef,
    overlayRef,
    stageRef,
  } as const;
}
