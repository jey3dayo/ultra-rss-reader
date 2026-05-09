import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser/browser-debug-geometry";
import type { BrowserViewerGeometry, BrowserViewerScope } from "@/lib/browser/browser-viewer-geometry";
import type { BrowserSurfaceIssue } from "./browser-surface-issue";

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

export type ResolveBrowserViewPresentationParams = {
  scope: BrowserViewerScope;
  viewportWidth: number;
  diagnosticsVisible: boolean;
  overlayTitlebar?: boolean;
};

export type ResolveBrowserViewSurfacePresentationParams = {
  scope: BrowserViewScope;
  compact: boolean;
};

export type BrowserOverlayCloseHandler = {
  onCloseOverlay: () => void;
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
