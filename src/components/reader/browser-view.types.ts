import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import type { PlatformInfo } from "@/api/schemas";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";
import type { BrowserViewerGeometry, BrowserViewerScope } from "@/lib/browser-viewer-geometry";
import type { ToastData } from "@/stores/ui-store";
import type { BrowserSurfaceIssue } from "./browser-surface-issue";
import type { BrowserWebviewFallbackPayload } from "./browser-webview-state";

export type BrowserViewScope = "content-pane" | "main-stage";
export type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;
export type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;
export type BrowserViewGeometry = BrowserViewerGeometry;

export type BrowserViewPresentation = {
  geometry: BrowserViewGeometry;
  closeButtonClass: string;
  actionButtonClass: string;
  stageClass: string;
};

export type ResolveBrowserViewPresentationParams = {
  scope: BrowserViewerScope;
  viewportWidth: number;
  diagnosticsVisible: boolean;
};

export type BrowserViewProps = {
  scope?: BrowserViewScope;
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
  toolbarActions?: ReactNode;
};

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
  hostRef: React.RefObject<HTMLDivElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
};

export type BrowserOverlayChromeController = Pick<
  BrowserViewController,
  "geometry" | "handleCloseOverlay" | "handleOpenExternal" | "closeButtonClass" | "actionButtonClass"
>;

export type BrowserOverlayChromeProps =
  | {
      controller: BrowserOverlayChromeController;
      closeOverlayLabel: string;
      toolbarActions?: ReactNode;
    }
  | {
      closeLabel: string;
      onClose: () => void;
    };

export type BrowserOverlayStageController = Pick<
  BrowserViewController,
  | "stageRef"
  | "hostRef"
  | "stageClass"
  | "geometry"
  | "isLoading"
  | "activeSurfaceIssue"
  | "showDiagnostics"
  | "handleRetry"
  | "handleOpenExternal"
>;

export type BrowserOverlayStageProps = {
  controller: BrowserOverlayStageController;
};

export type BrowserDiagnosticsRailProps = {
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  compact: boolean;
  top: number;
};

export type BrowserSurfaceStateCardProps = {
  issue: BrowserSurfaceIssue;
  showTechnicalDetail: boolean;
  onRetry: () => void;
  onOpenExternal: () => void;
  labels: {
    technicalDetail: string;
    retryWebPreview: string;
    openInExternalBrowser: string;
  };
};

export type UseBrowserViewRuntimeParams = {
  onCloseOverlay: () => void;
};

export type UseBrowserViewRuntimeResult = {
  showDiagnostics: boolean;
  browserUrl: string | null;
  showToast: (message: string | ToastData) => void;
  platformKind: PlatformInfo["kind"];
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  handleNativeDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
  viewportWidth: number;
  isLoading: boolean;
  handleCloseOverlay: () => void;
};

export type UseBrowserViewEventBridgeParams = {
  showDiagnostics: boolean;
  isLoading: boolean;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onCloseOverlay: () => void;
  onDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

export type UseBrowserViewEventBridgeResult = {
  setSurfaceIssue: (issue: BrowserSurfaceIssue | null) => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
  waitForBrowserWebviewListeners: () => Promise<void>;
};

export type UseBrowserViewSurfaceControllerParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
};

export type UseBrowserViewSurfaceControllerResult = {
  surfaceIssue: BrowserSurfaceIssue | null;
  setSurfaceIssue: (issue: BrowserSurfaceIssue | null) => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  handleBrowserWebviewFallback: (payload: BrowserWebviewFallbackPayload) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
};

export type UseBrowserViewSurfaceStateParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  runtimeUnavailable: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserMode: string;
  browserModeHint: string;
  failed: string;
  failedHint: string;
  blocked: string;
  blockedHint: string;
};

export type UseBrowserViewSurfaceStateResult = UseBrowserViewSurfaceControllerResult;

export type UseBrowserWebviewEventsParams = {
  showDiagnostics: boolean;
  onStateChanged: (payload: BrowserWebviewState) => void;
  onFallback: (payload: BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  onDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

export type UseBrowserWebviewEventsResult = () => Promise<void>;

export type UseBrowserOverlayShortcutsParams = {
  browserUrl: string | null;
  handleCloseOverlay: () => void;
};

export type UseBrowserWebviewLoadTimeoutParams = {
  browserUrl: string | null;
  isLoading: boolean;
  isStillLoading: () => boolean;
  showSurfaceFailure: (error: { type: "UserVisible"; message: string }) => void;
};

export type UseBrowserWebviewStateChangedParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: (state: BrowserWebviewState) => void;
  setSurfaceIssue: (issue: null) => void;
  getRequestedUrl: () => string;
};

export type UseBrowserWebviewBoundsSyncParams = {
  browserUrl: string | null;
  hostRef: RefObject<HTMLDivElement | null>;
  waitForBrowserWebviewListeners: () => Promise<void>;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
};

export type UseBrowserWebviewRequestStateParams = {
  browserUrl: string | null;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  resetBrowserWebviewSyncState: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  setSurfaceIssue: (issue: null) => void;
};

export type UseBrowserWebviewSyncParams = {
  hostRef: RefObject<HTMLDivElement | null>;
  platformKind: string;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  captureLayoutDiagnostics: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onMissingEmbeddedBrowserWebview: (error: AppError) => void;
  showSurfaceFailure: (error: AppError) => void;
};

export type UseBrowserDebugGeometryEventsParams = {
  showDiagnostics: boolean;
  layoutDiagnostics: BrowserDebugGeometryLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
};

export type UseBrowserLayoutDiagnosticsParams = {
  browserUrl: string | null;
  showDiagnostics: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
};

export type UseBrowserOverlayFocusReturnParams = {
  articleId: string;
  isBrowserOpen: boolean;
};

export type UseBrowserViewActionsParams = {
  browserUrl: string | null;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  setBrowserState: (state: BrowserWebviewState | null) => void;
  resetBrowserWebviewSyncState: () => void;
  setSurfaceIssue: (issue: null) => void;
  showToast: (message: string) => void;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
  initialBrowserState: (url: string) => BrowserWebviewState;
  fallbackInFlightRef: MutableRefObject<boolean>;
};
