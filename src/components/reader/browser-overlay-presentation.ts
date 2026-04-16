import type {
  BrowserOverlayActionSurfacePresentation,
  BrowserOverlayStageSurfacePresentation,
  BrowserViewScope,
} from "./browser-view.types";

export function getBrowserOverlayLeadingActionPresentation(
  _isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return {
    compact: true,
    tone: "default",
  };
}

export function getBrowserOverlayActionSurfacePresentation(
  _isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return {
    compact: true,
    tone: "default",
  };
}

export function getBrowserOverlayStagePresentation(scope: BrowserViewScope): BrowserOverlayStageSurfacePresentation {
  return {
    scope,
  };
}
