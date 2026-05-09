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

  it("does not register a duplicate legacy listener after modern registration partially succeeds", () => {
    const modernListeners = new Set<EventListenerOrEventListenerObject>();
    const legacyListeners = new Set<(event: MediaQueryListEvent) => void>();
    const listener = vi.fn();
    const mediaQuery = createMediaQueryList({
      addEventListener: vi.fn((_: string, nextListener: EventListenerOrEventListenerObject) => {
        modernListeners.add(nextListener);
        throw new Error("modern listener unavailable after registration");
      }),
      removeEventListener: vi.fn((_: string, nextListener: EventListenerOrEventListenerObject) => {
        modernListeners.delete(nextListener);
      }),
      addListener: vi.fn((nextListener: (event: MediaQueryListEvent) => void) => {
        legacyListeners.add(nextListener);
      }),
      removeListener: vi.fn((nextListener: (event: MediaQueryListEvent) => void) => {
        legacyListeners.delete(nextListener);
      }),
    });

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);
    const event = { matches: true } as MediaQueryListEvent;
    modernListeners.forEach((nextListener) => {
      if (typeof nextListener === "function") {
        nextListener(event);
      } else {
        nextListener.handleEvent(event);
      }
    });
    legacyListeners.forEach((nextListener) => {
      nextListener(event);
    });
    cleanup();

    expect(listener).toHaveBeenCalledOnce();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(mediaQuery.addListener).toHaveBeenCalledWith(listener);
    expect(mediaQuery.removeListener).toHaveBeenCalledWith(listener);
  });

  it("does not add a legacy listener when partial modern registration cannot be cleaned up", () => {
    const listener = vi.fn();
    const mediaQuery = createMediaQueryList({
      addEventListener: vi.fn(() => {
        throw new Error("modern listener unavailable after registration");
      }),
      removeEventListener: vi.fn(() => {
        throw new Error("modern cleanup failed");
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });

    const cleanup = subscribeMatchMediaChange(mediaQuery, listener);

    expect(() => cleanup()).not.toThrow();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith("change", listener);
    expect(mediaQuery.addListener).not.toHaveBeenCalled();
  });
});
