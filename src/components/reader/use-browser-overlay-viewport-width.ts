import { useEffect, useState } from "react";
import { bindWindowEvents } from "./use-browser-url-effect";

export function useBrowserOverlayViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1400 : window.innerWidth));

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    return bindWindowEvents([{ type: "resize", listener: handleResize }]);
  }, []);

  return viewportWidth;
}
