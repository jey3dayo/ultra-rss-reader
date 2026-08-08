// Shared `window.matchMedia` mock factories for frontend tests. Covers both
// the modern `addEventListener`/`removeEventListener` API and the legacy
// `addListener`/`removeListener` API so tests can exercise fallback and
// cleanup-failure behavior at the runtime boundary.

export type MatchMediaChangeEvent = Pick<MediaQueryListEvent, "matches">;

const DEFAULT_COLOR_SCHEME_MEDIA = "(prefers-color-scheme: dark)";

/**
 * Modern `matchMedia` mock using `addEventListener` / `removeEventListener`.
 * Exposes `listenerCount()` for asserting listener cleanup and `dispatch()`
 * for simulating a system preference change.
 */
export function createModernMatchMedia(initialMatches: boolean, media: string = DEFAULT_COLOR_SCHEME_MEDIA) {
  let matches = initialMatches;
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: (_type: "change", listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

/**
 * Legacy `matchMedia` mock using `addListener` / `removeListener`. Set
 * `options.throwOnRemove` to simulate a runtime whose legacy cleanup API
 * throws, so callers can assert that cleanup failures are ignored.
 */
export function createLegacyMatchMedia(
  initialMatches: boolean,
  options: { throwOnRemove?: boolean } = {},
  media: string = DEFAULT_COLOR_SCHEME_MEDIA,
) {
  let matches = initialMatches;
  const listeners = new Set<(event: MatchMediaChangeEvent) => void>();

  return {
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MatchMediaChangeEvent) => void) => {
      if (options.throwOnRemove) {
        throw new Error("legacy cleanup unavailable");
      }
      listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    dispatch(nextMatches: boolean) {
      matches = nextMatches;
      const event: MatchMediaChangeEvent = { matches: nextMatches };
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}
