import { describe, expect, it } from "vitest";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "@/components/reader/browser-overlay-presentation";

describe("browser-overlay-presentation", () => {
  it("returns the compact and desktop close button variants", () => {
    expect(getBrowserOverlayCloseButtonClass(true)).toContain("bg-black/32");
    expect(getBrowserOverlayCloseButtonClass(false)).toContain("bg-black/30");
  });

  it("returns the compact and desktop action button variants", () => {
    expect(getBrowserOverlayActionButtonClass(true)).toContain("bg-black/32");
    expect(getBrowserOverlayActionButtonClass(false)).toContain("bg-black/26");
  });

  it("returns the stage shell variant for each scope", () => {
    expect(getBrowserOverlayStageClass("main-stage")).toBe("absolute z-10 overflow-hidden bg-background");
    expect(getBrowserOverlayStageClass("content-pane")).toContain("shadow-[0_20px_48px_rgba(0,0,0,0.24)]");
  });
});
