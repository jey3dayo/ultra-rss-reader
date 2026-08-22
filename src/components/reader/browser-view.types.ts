import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser/browser-debug-geometry";
import type { BrowserSurfaceIssue } from "@/lib/browser/browser-surface-issue";
import type {
  BrowserViewerGeometry,
  BrowserViewerGeometryInput,
  BrowserViewerScope,
} from "@/lib/browser/browser-viewer-geometry";

export type BrowserViewScope = BrowserViewerScope;
export type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;
export type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;
export type BrowserViewGeometry = BrowserViewerGeometry;
type BrowserOverlayActionSurfaceTone = "default" | "subtle";
export type BrowserOverlayActionSurfacePresentation = {
  compact: boolean;
  tone: BrowserOverlayActionSurfaceTone;
};
export type BrowserOverlayStageSurfacePresentation = {
  scope: BrowserViewScope;
};

export type BrowserViewSurfacePresentation = {
  leadingActionSurface: BrowserOverlayActionSurfacePresentation;
  actionButtonSurface: BrowserOverlayActionSurfacePresentation;
  stageSurface: BrowserOverlayStageSurfacePresentation;
};

export type BrowserOverlayToolbarAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
};

export type BrowserViewPresentation = BrowserViewSurfacePresentation & {
  geometry: BrowserViewGeometry;
};

// Alias: the geometry input in src/lib/browser/browser-viewer-geometry.ts is
// the source of truth for these fields; presentation resolution takes the
// same input and only adds derived view state on top.
export type ResolveBrowserViewPresentationParams = BrowserViewerGeometryInput;

export type ResolveBrowserViewSurfacePresentationParams = {
  scope: BrowserViewScope;
  compact: boolean;
};

export type BrowserOverlayCloseHandler = {
  onCloseOverlay: () => void;
  onBrowserWebviewClosed?: () => void;
};

export type BrowserWebviewStateBinding = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
};

export type BrowserViewController = {
  browserUrl: string | null;
  browserState: BrowserWebviewState | null;
  showDiagnostics: boolean;
  geometry: BrowserViewGeometry;
  presentation: BrowserViewSurfacePresentation;
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
  isLoading: boolean;
  handleCloseOverlay: () => void;
  handleGoBack: () => Promise<void>;
  handleGoForward: () => Promise<void>;
  handleRetry: () => void;
  handleReload: () => Promise<void>;
  handleOpenExternal: () => Promise<void>;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
};

export type BrowserOverlayChromeController = Pick<
  BrowserViewController,
  | "browserState"
  | "geometry"
  | "handleCloseOverlay"
  | "handleGoBack"
  | "handleGoForward"
  | "handleReload"
  | "handleOpenExternal"
>;

export type BrowserOverlayStageController = Pick<
  BrowserViewController,
  | "stageRef"
  | "hostRef"
  | "presentation"
  | "geometry"
  | "isLoading"
  | "activeSurfaceIssue"
  | "showDiagnostics"
  | "handleRetry"
  | "handleOpenExternal"
>;
