import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "./browser-overlay-presentation";
import type { BrowserViewPresentation, ResolveBrowserViewPresentationParams } from "./browser-view.types";

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
