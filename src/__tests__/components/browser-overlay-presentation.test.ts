import { describe, expect, it } from "vitest";
import {
  getBrowserOverlayActionSurfacePresentation,
  getBrowserOverlayLeadingActionPresentation,
  getBrowserOverlayStagePresentation,
} from "@/components/reader/browser-overlay-presentation";

describe("browser-overlay-presentation", () => {
  it("returns semantic leading action surface props for compact and desktop viewers", () => {
    expect(getBrowserOverlayLeadingActionPresentation(true)).toEqual({
      compact: true,
      tone: "default",
    });
    expect(getBrowserOverlayLeadingActionPresentation(false)).toEqual({
      compact: false,
      tone: "default",
    });
  });

  it("returns semantic action surface props for compact and desktop viewers", () => {
    expect(getBrowserOverlayActionSurfacePresentation(true)).toEqual({
      compact: true,
      tone: "default",
    });
    expect(getBrowserOverlayActionSurfacePresentation(false)).toEqual({
      compact: false,
      tone: "default",
    });
  });

  it("returns the semantic stage scope for each browser overlay context", () => {
    expect(getBrowserOverlayStagePresentation("main-stage")).toEqual({
      scope: "main-stage",
    });
    expect(getBrowserOverlayStagePresentation("content-pane")).toEqual({
      scope: "content-pane",
    });
  });
});
