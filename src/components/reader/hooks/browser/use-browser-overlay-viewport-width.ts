import { useEffect, useReducer } from "react";
import { bindWindowEvents } from "@/lib/window/window-events";

type BrowserOverlayViewportWidthState = {
  viewportWidth: number;
};

type BrowserOverlayViewportWidthAction = { type: "set-viewport-width"; value: number };

const BROWSER_OVERLAY_VIEWPORT_WIDTH_FALLBACK = 1400;

function normalizeBrowserOverlayViewportWidth(viewportWidth: unknown): number {
  if (typeof viewportWidth !== "number" || !Number.isFinite(viewportWidth) || viewportWidth < 0) {
    return BROWSER_OVERLAY_VIEWPORT_WIDTH_FALLBACK;
  }

  return viewportWidth;
}

function readBrowserOverlayViewportWidth(): number {
  if (typeof window === "undefined") {
    return BROWSER_OVERLAY_VIEWPORT_WIDTH_FALLBACK;
  }

  try {
    return normalizeBrowserOverlayViewportWidth(window.innerWidth);
  } catch (error) {
    console.warn("Failed to read browser overlay viewport width.", error);
    return BROWSER_OVERLAY_VIEWPORT_WIDTH_FALLBACK;
  }
}

function createInitialBrowserOverlayViewportWidthState(): BrowserOverlayViewportWidthState {
  return {
    viewportWidth: readBrowserOverlayViewportWidth(),
  };
}

function browserOverlayViewportWidthReducer(
  state: BrowserOverlayViewportWidthState,
  action: BrowserOverlayViewportWidthAction,
): BrowserOverlayViewportWidthState {
  switch (action.type) {
    case "set-viewport-width":
      return { ...state, viewportWidth: action.value };
    default:
      return state;
  }
}

export function useBrowserOverlayViewportWidth() {
  const [state, dispatch] = useReducer(
    browserOverlayViewportWidthReducer,
    undefined,
    createInitialBrowserOverlayViewportWidthState,
  );
  const { viewportWidth } = state;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      dispatch({ type: "set-viewport-width", value: readBrowserOverlayViewportWidth() });
    };

    handleResize();
    let cleanup: (() => void) | null = null;
    try {
      cleanup = bindWindowEvents([{ type: "resize", listener: handleResize }]);
    } catch (error) {
      console.warn("Failed to bind browser overlay viewport resize listener.", error);
      return undefined;
    }

    return () => {
      try {
        cleanup?.();
      } catch (error) {
        console.warn("Failed to cleanup browser overlay viewport resize listener.", error);
      }
    };
  }, []);

  return viewportWidth;
}
