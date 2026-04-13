import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import type { PlatformInfo } from "@/api/schemas";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";
import type { ToastData } from "@/stores/ui-store";
import type { BrowserSurfaceIssue } from "./browser-surface-issue";

export type BrowserViewScope = "content-pane" | "main-stage";
export type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;
export type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;
export type BrowserViewGeometry = ReturnType<
  typeof import("./browser-view-presentation").resolveBrowserViewPresentation
>["geometry"];

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
  handleBrowserWebviewFallback: (payload: import("./browser-webview-state").BrowserWebviewFallbackPayload) => void;
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
  onFallback: (payload: import("./browser-webview-state").BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  onDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

export type UseBrowserWebviewEventsResult = () => Promise<void>;
