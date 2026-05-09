import { describe, expect, it, vi } from "vitest";
import { subscribeMatchMediaChange } from "@/lib/runtime/match-media-listener";

function createMediaQueryList(overrides: Partial<MediaQueryList> = {}): MediaQueryList {
  return {
    matches: false,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    ...overrides,
  };
}

type MatchMediaRegistrationFixture = {
  mediaQuery: MediaQueryList;
  modernListeners: Set<EventListenerOrEventListenerObject>;
  legacyListeners: Set<(event: MediaQueryListEvent) => void>;
};

function createPartialModernRegistrationFixture({
  modernCleanupThrows = false,
}: {
  modernCleanupThrows?: boolean;
} = {}): MatchMediaRegistrationFixture {
  const modernListeners = new Set<EventListenerOrEventListenerObject>();
  const legacyListeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = createMediaQueryList({
    addEventListener: vi.fn((_: string, nextListener: EventListenerOrEventListenerObject) => {
      modernListeners.add(nextListener);
      throw new Error("modern listener unavailable after registration");
    }),
    removeEventListener: vi.fn((_: string, nextListener: EventListenerOrEventListenerObject) => {
      if (modernCleanupThrows) {
        throw new Error("modern cleanup failed");
      }
      modernListeners.delete(nextListener);
    }),
    addListener: vi.fn((nextListener: (event: MediaQueryListEvent) => void) => {
      legacyListeners.add(nextListener);
    }),
    removeListener: vi.fn((nextListener: (event: MediaQueryListEvent) => void) => {
      legacyListeners.delete(nextListener);
    }),
  });

  return { mediaQuery, modernListeners, legacyListeners };
}

function dispatchMatchMediaChange(listeners: Iterable<EventListenerOrEventListenerObject>) {
  const event = { matches: true } as MediaQueryListEvent;

  for (const nextListener of listeners) {
    if (typeof nextListener === "function") {
      nextListener(event);
    } else {
      nextListener.handleEvent(event);
    }
  }
}

describe("match-media-listener", () => {
  it("returns a no-op cleanup when no listener API is available", () => {
    const mediaQuery = createMediaQueryList();
    Object.defineProperties(mediaQuery, {
      addEventListener: { configurable: true, value: undefined },
      removeEventListener: { configurable: true, value: undefined },
      addListener: { configurable: true, value: undefined },
      removeListener: { configurable: true, value: undefined },
    });
    const listener = vi.fn();

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);

    expect(() => cleanup()).not.toThrow();
  });

  it("falls back to legacy listeners when modern listener registration throws", () => {
    const error = new Error("modern listener unavailable");
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const mediaQuery = createMediaQueryList({
      addEventListener: vi.fn(() => {
        throw error;
      }),
      addListener,
      removeListener,
    });
    const listener = vi.fn();

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);
    cleanup();

    expect(addListener).toHaveBeenCalledWith(listener);
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("uses legacy add and remove when modern listeners are unavailable", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    const mediaQuery = createMediaQueryList({
      addEventListener: undefined,
      removeEventListener: undefined,
      addListener,
      removeListener,
    });
    const listener = vi.fn();

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);
    cleanup();

    expect(addListener).toHaveBeenCalledWith(listener);
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("keeps cleanup non-fatal when modern listener removal throws", () => {
    const listener = vi.fn();
    const mediaQuery = createMediaQueryList({
      removeEventListener: vi.fn(() => {
        throw new Error("remove failed");
      }),
    });

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);

    expect(() => cleanup()).not.toThrow();
  });

  it("runs modern listener cleanup at most once", () => {
    const mediaQuery = createMediaQueryList();
    const listener = vi.fn();

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);
    cleanup();
    cleanup();

    expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("does not register a duplicate legacy listener after modern registration partially succeeds", () => {
    const listener = vi.fn();
    const { mediaQuery, modernListeners, legacyListeners } = createPartialModernRegistrationFixture();

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);
    dispatchMatchMediaChange(modernListeners);
    legacyListeners.forEach((nextListener) => {
      nextListener({ matches: true } as MediaQueryListEvent);
    });
    cleanup();

    expect(listener).toHaveBeenCalledOnce();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(mediaQuery.addListener).toHaveBeenCalledWith(listener);
    expect(mediaQuery.removeListener).toHaveBeenCalledWith(listener);
  });

  it("does not add a legacy listener when partial modern registration cannot be cleaned up", () => {
    const listener = vi.fn();
    const { mediaQuery } = createPartialModernRegistrationFixture({
      modernCleanupThrows: true,
    });

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);

    expect(() => cleanup()).not.toThrow();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(mediaQuery.addListener).not.toHaveBeenCalled();
  });
});
