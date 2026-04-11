import { describe, expect, it } from "vitest";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";

describe("resolveBrowserViewerGeometry", () => {
  it("keeps the immersive stage full-bleed when diagnostics are hidden", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(0);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(false);
    expect(geometry.host.left).toBe(0);
    expect(geometry.host.top).toBe(60);
    expect(geometry.host.right).toBe(0);
    expect(geometry.host.bottom).toBe(0);
    expect(geometry.chrome.close.left).toBe(12);
    expect(geometry.chrome.close.top).toBe(12);
    expect(geometry.chrome.close.size).toBe(40);
    expect(geometry.chrome.action.right).toBe(12);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(40);
  });

  it("keeps the stage full-bleed even when diagnostics are visible", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: true,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(0);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.host.top).toBe(60);
    expect(geometry.diagnostics.compact).toBe(true);
    expect(geometry.diagnostics.top).toBe(62);
  });

  it("keeps the wide stage full-bleed even when diagnostics are visible", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
    });

    expect(geometry.compact).toBe(false);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(0);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(false);
    expect(geometry.host.top).toBe(70);
  });

  it("keeps the desktop stage full-bleed for floating chrome", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(false);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(0);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(false);
    expect(geometry.host.top).toBe(70);
    expect(geometry.chrome.close.left).toBe(16);
    expect(geometry.chrome.close.top).toBe(16);
  });

  it("keeps the ultra-compact stage full-bleed with compact chrome sizing", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 520,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.ultraCompact).toBe(true);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(0);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(false);
    expect(geometry.host.top).toBe(60);
    expect(geometry.chrome.close.left).toBe(12);
    expect(geometry.chrome.close.top).toBe(12);
    expect(geometry.chrome.close.size).toBe(40);
    expect(geometry.chrome.action.right).toBe(12);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(40);
  });
});
