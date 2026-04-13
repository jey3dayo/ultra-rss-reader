import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBrowserUrlEffect, useBrowserUrlLayoutEffect } from "@/components/reader/use-browser-url-effect";

describe("useBrowserUrlEffect", () => {
  it("skips the effect when browserUrl is missing", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlEffect(null, effect, []);
    });

    expect(effect).not.toHaveBeenCalled();
  });

  it("runs the effect with the active browserUrl", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlEffect("https://example.com/article", effect, []);
    });

    expect(effect).toHaveBeenCalledWith("https://example.com/article");
  });
});

describe("useBrowserUrlLayoutEffect", () => {
  it("runs the layout effect with the active browserUrl", () => {
    const effect = vi.fn();

    renderHook(() => {
      useBrowserUrlLayoutEffect("https://example.com/article", effect, []);
    });

    expect(effect).toHaveBeenCalledWith("https://example.com/article");
  });
});
