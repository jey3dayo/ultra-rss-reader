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
});
