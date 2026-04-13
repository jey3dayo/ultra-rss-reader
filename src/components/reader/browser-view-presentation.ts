import {
  type BrowserViewerGeometry,
  type BrowserViewerScope,
  resolveBrowserViewerGeometry,
} from "@/lib/browser-viewer-geometry";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "./browser-overlay-presentation";

export type BrowserViewPresentation = {
  geometry: BrowserViewerGeometry;
  closeButtonClass: string;
  actionButtonClass: string;
  stageClass: string;
};

type ResolveBrowserViewPresentationParams = {
  scope: BrowserViewerScope;
  viewportWidth: number;
  diagnosticsVisible: boolean;
};

export function resolveBrowserViewPresentation({
  scope,
  viewportWidth,
  diagnosticsVisible,
}: ResolveBrowserViewPresentationParams): BrowserViewPresentation {
  const geometry = resolveBrowserViewerGeometry({
    scope,
    viewportWidth,
    diagnosticsVisible,
  });
  const isCompactViewer = geometry.compact;

  return {
    geometry,
    closeButtonClass: getBrowserOverlayCloseButtonClass(isCompactViewer),
    actionButtonClass: getBrowserOverlayActionButtonClass(isCompactViewer),
    stageClass: getBrowserOverlayStageClass(scope),
  };
}
