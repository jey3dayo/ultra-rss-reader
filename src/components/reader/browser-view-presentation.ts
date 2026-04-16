import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayLeadingActionClass,
  getBrowserOverlayStageClass,
} from "./browser-overlay-presentation";
import type { BrowserViewPresentation, ResolveBrowserViewPresentationParams } from "./browser-view.types";

export function resolveBrowserViewPresentation({
  scope,
  viewportWidth,
  diagnosticsVisible,
  overlayTitlebar,
}: ResolveBrowserViewPresentationParams): BrowserViewPresentation {
  const geometry = resolveBrowserViewerGeometry({
    scope,
    viewportWidth,
    diagnosticsVisible,
    overlayTitlebar,
  });
  const isCompactViewer = geometry.compact;

  return {
    geometry,
    leadingActionClass: getBrowserOverlayLeadingActionClass(isCompactViewer),
    actionButtonClass: getBrowserOverlayActionButtonClass(isCompactViewer),
    stageClass: getBrowserOverlayStageClass(scope),
  };
}
