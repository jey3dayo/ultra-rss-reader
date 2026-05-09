import { useMemo } from "react";
import { useBrowserDebugGeometryEvents } from "@/components/reader/hooks/browser/use-browser-debug-geometry-events";
import { useBrowserLayoutDiagnostics } from "@/components/reader/hooks/browser/use-browser-layout-diagnostics";
import { useBrowserOverlayShortcuts } from "@/components/reader/hooks/browser/use-browser-overlay-shortcuts";
import { useBrowserViewActions } from "@/components/reader/hooks/browser/use-browser-view-actions";
import { useBrowserViewEventBridge } from "@/components/reader/hooks/browser/use-browser-view-event-bridge";
import { useBrowserViewRuntime } from "@/components/reader/hooks/browser/use-browser-view-runtime";
import { useBrowserWebviewBoundsSync } from "@/components/reader/hooks/browser/use-browser-webview-bounds-sync";
import { useBrowserWebviewCleanup } from "@/components/reader/hooks/browser/use-browser-webview-cleanup";
import { useBrowserWebviewLoadTimeout } from "@/components/reader/hooks/browser/use-browser-webview-load-timeout";
import { useBrowserWebviewRequestState } from "@/components/reader/hooks/browser/use-browser-webview-request-state";
import { useBrowserWebviewSync } from "@/components/reader/hooks/browser/use-browser-webview-sync";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import type { BrowserViewController, BrowserViewScope } from "../../browser-view.types";
import { resolveBrowserViewPresentation } from "../../browser-view-presentation";
import { initialBrowserState } from "../../browser-webview-state";

export type UseBrowserViewControllerParams = {
  scope: BrowserViewScope;
  onCloseOverlay: () => void;
};

export function useBrowserViewController({
  scope,
  onCloseOverlay,
}: UseBrowserViewControllerParams): BrowserViewController {
  const {
    showDiagnostics,
    browserUrl,
    browserState,
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
    clearSurfaceIssue,
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
    clearSurfaceIssue,
  });

  useBrowserWebviewBoundsSync({
    browserUrl,
    hostRef,
    waitForBrowserWebviewListeners,
    syncBrowserWebview,
    showSurfaceFailure,
  });

  useBrowserWebviewCleanup();

  useBrowserWebviewLoadTimeout({
    browserUrl,
    isLoading,
    isStillLoading: () => Boolean(browserStateRef.current?.is_loading),
    showSurfaceFailure,
  });

  useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay });

  const { handleGoBack, handleGoForward, handleRetry, handleReload, handleOpenExternal } = useBrowserViewActions({
    browserUrl,
    browserStateRef,
    setBrowserState,
    resetBrowserWebviewSyncState,
    clearSurfaceIssue,
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
    browserState,
    showDiagnostics,
    geometry: presentation.geometry,
    presentation,
    layoutDiagnostics,
    nativeDiagnostics,
    activeSurfaceIssue,
    isLoading,
    handleCloseOverlay,
    handleGoBack,
    handleGoForward,
    handleRetry,
    handleReload,
    handleOpenExternal,
    hostRef,
    overlayRef,
    stageRef,
  };
}
