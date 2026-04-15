import { describe, expect, it } from "vitest";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayCloseButtonClass,
  getBrowserOverlayStageClass,
} from "@/components/reader/browser-overlay-presentation";

describe("browser-overlay-presentation", () => {
  it("returns the compact and desktop close button variants", () => {
    expect(getBrowserOverlayCloseButtonClass(true)).toContain("bg-background/72");
    expect(getBrowserOverlayCloseButtonClass(false)).toContain("bg-background/78");
    expect(getBrowserOverlayCloseButtonClass(false, true)).toContain("size-[30px]");
    expect(getBrowserOverlayCloseButtonClass(false, true)).not.toContain("size-10");
  });

  it("returns the compact and desktop action button variants", () => {
    expect(getBrowserOverlayActionButtonClass(true)).toContain("bg-background/72");
    expect(getBrowserOverlayActionButtonClass(false)).toContain("bg-background/74");
  });

  it("returns the stage shell variant for each scope", () => {
    expect(getBrowserOverlayStageClass("main-stage")).toBe("absolute z-10 overflow-hidden bg-background");
    expect(getBrowserOverlayStageClass("content-pane")).toContain("border-border/60");
    expect(getBrowserOverlayStageClass("content-pane")).toContain("shadow-elevation-3");
  });
});
