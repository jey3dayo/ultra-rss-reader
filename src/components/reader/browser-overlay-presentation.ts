import type {
  BrowserOverlayActionSurfacePresentation,
  BrowserOverlayStageSurfacePresentation,
  BrowserViewScope,
} from "./browser-view.types";

export function getBrowserOverlayLeadingActionPresentation(
  isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return {
    compact: isCompactViewer,
    tone: "default",
  };
}

export function getBrowserOverlayActionSurfacePresentation(
  isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return {
    compact: isCompactViewer,
    tone: "default",
  };
}

export function getBrowserOverlayStagePresentation(scope: BrowserViewScope): BrowserOverlayStageSurfacePresentation {
  return {
    scope,
  };
}
