import { useEffect, useReducer } from "react";
import { bindWindowEvents } from "@/lib/window/window-events";

type BrowserOverlayViewportWidthState = {
  viewportWidth: number;
};

type BrowserOverlayViewportWidthAction = { type: "set-viewport-width"; value: number };

function createInitialBrowserOverlayViewportWidthState(): BrowserOverlayViewportWidthState {
  return {
    viewportWidth: typeof window === "undefined" ? 1400 : window.innerWidth,
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
      dispatch({ type: "set-viewport-width", value: window.innerWidth });
    };

    handleResize();
    return bindWindowEvents([{ type: "resize", listener: handleResize }]);
  }, []);

  return viewportWidth;
}
