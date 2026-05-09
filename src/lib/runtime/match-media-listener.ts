type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: MediaQueryChangeListener) => void;
  removeListener?: (listener: MediaQueryChangeListener) => void;
};

function createSafeCleanup(cleanup: () => void): () => void {
  let cleanedUp = false;

  return () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    try {
      cleanup();
    } catch {
      // Browser/WebView cleanup should not make React unmount fail.
    }
  };
}

export function subscribeMatchMediaChange(
  mediaQuery: MediaQueryList,
  listener: MediaQueryChangeListener,
): () => void {
  const legacyMediaQuery = mediaQuery as LegacyMediaQueryList;

  if (typeof legacyMediaQuery.addEventListener === "function") {
    try {
      legacyMediaQuery.addEventListener("change", listener);
      return createSafeCleanup(() => {
        legacyMediaQuery.removeEventListener("change", listener);
      });
    } catch {
      try {
        legacyMediaQuery.removeEventListener?.("change", listener);
      } catch {
        return () => {};
      }
      // Fall through to the legacy listener API below.
    }
  }

  if (typeof legacyMediaQuery.addListener === "function") {
    legacyMediaQuery.addListener(listener);
    return createSafeCleanup(() => {
      legacyMediaQuery.removeListener?.(listener);
    });
  }

  return () => {};
}
