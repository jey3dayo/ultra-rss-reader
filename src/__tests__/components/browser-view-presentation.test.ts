import { describe, expect, it } from "vitest";
import { resolveBrowserViewPresentation } from "@/components/reader/browser-view-presentation";

describe("browser-view-presentation", () => {
  it("returns compact main-stage geometry with compact chrome classes", () => {
    const presentation = resolveBrowserViewPresentation({
      scope: "main-stage",
      viewportWidth: 500,
      diagnosticsVisible: false,
    });

    expect(presentation.geometry.compact).toBe(true);
    expect(presentation.geometry.stage.top).toBe(64);
    expect(presentation.closeButtonClass).toContain("bg-black/32");
    expect(presentation.actionButtonClass).toContain("bg-black/32");
    expect(presentation.stageClass).toBe("absolute z-10 overflow-hidden bg-background");
  });

  it("returns content-pane geometry with the inset stage shell class", () => {
    const presentation = resolveBrowserViewPresentation({
      scope: "content-pane",
      viewportWidth: 1200,
      diagnosticsVisible: true,
    });

    expect(presentation.geometry.compact).toBe(false);
    expect(presentation.geometry.stage.top).toBe(56);
    expect(presentation.closeButtonClass).toContain("bg-black/30");
    expect(presentation.actionButtonClass).toContain("bg-black/26");
    expect(presentation.stageClass).toContain("shadow-[0_20px_48px_rgba(0,0,0,0.24)]");
  });
});
