import { describe, expect, it } from "vitest";
import {
  getBrowserOverlayActionButtonClass,
  getBrowserOverlayLeadingActionClass,
  getBrowserOverlayStageClass,
} from "@/components/reader/browser-overlay-presentation";

describe("browser-overlay-presentation", () => {
  it("returns the compact and desktop leading action variants", () => {
    expect(getBrowserOverlayLeadingActionClass(true)).toContain("bg-background/78");
    expect(getBrowserOverlayLeadingActionClass(true)).toContain("size-11");
    expect(getBrowserOverlayLeadingActionClass(false)).toContain("bg-background/78");
    expect(getBrowserOverlayLeadingActionClass(false)).toContain("px-3");
    expect(getBrowserOverlayLeadingActionClass(false)).toContain("rounded-full");
  });

  it("returns the compact and desktop action button variants", () => {
    expect(getBrowserOverlayActionButtonClass(true)).toContain("bg-background/78");
    expect(getBrowserOverlayActionButtonClass(false)).toContain("bg-background/78");
    expect(getBrowserOverlayActionButtonClass(false)).toContain("rounded-full");
  });

  it("returns the stage shell variant for each scope", () => {
    expect(getBrowserOverlayStageClass("main-stage")).toBe("absolute z-10 overflow-hidden bg-background");
    expect(getBrowserOverlayStageClass("content-pane")).toContain("border-border/60");
    expect(getBrowserOverlayStageClass("content-pane")).toContain("shadow-elevation-3");
  });
});
