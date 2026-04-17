import type {
  BrowserOverlayActionSurfacePresentation,
  BrowserOverlayStageSurfacePresentation,
  BrowserViewScope,
} from "./browser-view.types";

const chromeShellActionSurfacePresentation: BrowserOverlayActionSurfacePresentation = {
  compact: true,
  tone: "default",
};

export function getBrowserOverlayLeadingActionPresentation(
  _isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return chromeShellActionSurfacePresentation;
}

export function getBrowserOverlayActionSurfacePresentation(
  _isCompactViewer: boolean,
): BrowserOverlayActionSurfacePresentation {
  return chromeShellActionSurfacePresentation;
}

export function getBrowserOverlayStagePresentation(scope: BrowserViewScope): BrowserOverlayStageSurfacePresentation {
  return {
    scope,
  };
}
