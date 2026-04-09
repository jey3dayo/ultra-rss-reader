import { describe, expect, it } from "vitest";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";

describe("resolveBrowserViewerGeometry", () => {
  it("keeps the immersive stage close to the overlay edges when diagnostics are hidden", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.stage.left).toBe(12);
    expect(geometry.stage.top).toBe(60);
    expect(geometry.stage.right).toBe(12);
    expect(geometry.stage.bottom).toBe(12);
    expect(geometry.chromeRail.visible).toBe(true);
  });

  it("reserves a dedicated top lane only when diagnostics are visible", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: true,
    });

    expect(geometry.stage.top).toBe(94);
    expect(geometry.diagnostics.compact).toBe(true);
    expect(geometry.diagnostics.top).toBe(62);
  });

  it("uses wider desktop margins without shrinking the stage for floating chrome", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(false);
    expect(geometry.stage.left).toBe(16);
    expect(geometry.stage.top).toBe(16);
    expect(geometry.chromeRail.visible).toBe(false);
    expect(geometry.chrome.close.left).toBe(16);
    expect(geometry.chrome.close.top).toBe(16);
  });
});
