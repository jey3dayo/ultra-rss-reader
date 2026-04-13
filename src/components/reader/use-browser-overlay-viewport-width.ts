import { useEffect, useState } from "react";

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
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return viewportWidth;
}
