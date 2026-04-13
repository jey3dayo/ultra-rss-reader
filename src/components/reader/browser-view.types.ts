import type { ReactNode } from "react";
import type { BrowserViewController } from "./use-browser-view-controller";

export type BrowserViewScope = "content-pane" | "main-stage";

export type BrowserViewProps = {
  scope?: BrowserViewScope;
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
  toolbarActions?: ReactNode;
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
