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
    expect(presentation.closeButtonClass).toContain("bg-background/72");
    expect(presentation.actionButtonClass).toContain("bg-background/72");
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
    expect(presentation.closeButtonClass).toContain("bg-background/78");
    expect(presentation.actionButtonClass).toContain("bg-background/74");
    expect(presentation.stageClass).toContain("border-border/60");
    expect(presentation.stageClass).toContain("shadow-elevation-3");
  });
});
