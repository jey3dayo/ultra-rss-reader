type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: MediaQueryChangeListener) => void;
  removeListener?: (listener: MediaQueryChangeListener) => void;
};

export function subscribeMatchMediaChange(mediaQuery: MediaQueryList, listener: MediaQueryChangeListener): () => void {
  const legacyMediaQuery = mediaQuery as LegacyMediaQueryList;

  if (typeof legacyMediaQuery.addEventListener === "function") {
    try {
      legacyMediaQuery.addEventListener("change", listener);
      return () => {
        try {
          legacyMediaQuery.removeEventListener("change", listener);
        } catch {
          // Browser/WebView cleanup should not make React unmount fail.
        }
      };
    } catch {
      // Fall through to the legacy listener API below.
    }
  }

  if (typeof legacyMediaQuery.addListener === "function") {
    legacyMediaQuery.addListener(listener);
    return () => {
      try {
        legacyMediaQuery.removeListener?.(listener);
      } catch {
        // Browser/WebView cleanup should not make React unmount fail.
      }
    };
  }

  return () => {};
}
