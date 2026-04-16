import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import {
  getBrowserOverlayActionSurfacePresentation,
  getBrowserOverlayLeadingActionPresentation,
  getBrowserOverlayStagePresentation,
} from "./browser-overlay-presentation";
import type {
  BrowserViewPresentation,
  BrowserViewSurfacePresentation,
  ResolveBrowserViewPresentationParams,
  ResolveBrowserViewSurfacePresentationParams,
} from "./browser-view.types";

export function resolveBrowserViewSurfacePresentation({
  scope,
  compact,
}: ResolveBrowserViewSurfacePresentationParams): BrowserViewSurfacePresentation {
  return {
    leadingActionSurface: getBrowserOverlayLeadingActionPresentation(compact),
    actionButtonSurface: getBrowserOverlayActionSurfacePresentation(compact),
    stageSurface: getBrowserOverlayStagePresentation(scope),
  };
}

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
  const surfaces = resolveBrowserViewSurfacePresentation({
    scope,
    compact: geometry.compact,
  });

  return {
    geometry,
    ...surfaces,
  };
}
