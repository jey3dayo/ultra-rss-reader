import type { Dispatch, MutableRefObject, ReactNode, RefObject, SetStateAction } from "react";
import type { PlatformInfo } from "@/api/schemas";
import type { BrowserWebviewState } from "@/api/tauri-commands";
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
