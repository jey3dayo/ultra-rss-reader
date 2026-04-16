import { describe, expect, it } from "vitest";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";

describe("resolveBrowserViewerGeometry", () => {
  it("exposes the compact main-stage top rail contract", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.ultraCompact).toBe(false);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(64);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(true);
    expect(geometry.chromeRail.left).toBe(0);
    expect(geometry.chromeRail.right).toBe(0);
    expect(geometry.chromeRail.top).toBe(0);
    expect(geometry.chromeRail.height).toBe(64);
    expect(geometry.chromeRail.radius).toBe(0);
    expect(geometry.host.left).toBe(0);
    expect(geometry.host.top).toBe(0);
    expect(geometry.host.right).toBe(0);
    expect(geometry.host.bottom).toBe(0);
    expect(geometry.diagnostics.compact).toBe(true);
    expect(geometry.diagnostics.top).toBe(66);
    expect(geometry.chrome.visualHeaderHeight).toBe(64);
    expect(geometry.chrome.leadingSafeInset).toBe(12);
    expect(geometry.chrome.leading.left).toBe(12);
    expect(geometry.chrome.leading.top).toBe(12);
    expect(geometry.chrome.action.right).toBe(12);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(44);
  });

  it("keeps diagnostics from changing the compact main-stage geometry", () => {
    const hiddenDiagnostics = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: false,
    });
    const visibleDiagnostics = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: true,
    });

    expect(hiddenDiagnostics.diagnostics.compact).toBe(true);
    expect(hiddenDiagnostics.diagnostics.top).toBe(66);
    expect(visibleDiagnostics.diagnostics.compact).toBe(true);
    expect(visibleDiagnostics.diagnostics.top).toBe(66);
    expect(visibleDiagnostics).toEqual(hiddenDiagnostics);
  });

  it("exposes the desktop main-stage top rail contract", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
    });

    expect(geometry.compact).toBe(false);
    expect(geometry.ultraCompact).toBe(false);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(56);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(true);
    expect(geometry.chromeRail.left).toBe(0);
    expect(geometry.chromeRail.right).toBe(0);
    expect(geometry.chromeRail.top).toBe(0);
    expect(geometry.chromeRail.height).toBe(56);
    expect(geometry.chromeRail.radius).toBe(0);
    expect(geometry.host.left).toBe(0);
    expect(geometry.host.top).toBe(0);
    expect(geometry.host.right).toBe(0);
    expect(geometry.host.bottom).toBe(0);
    expect(geometry.diagnostics.compact).toBe(false);
    expect(geometry.diagnostics.top).toBe(64);
    expect(geometry.chrome.visualHeaderHeight).toBe(56);
    expect(geometry.chrome.leadingSafeInset).toBe(16);
    expect(geometry.chrome.leading.left).toBe(16);
    expect(geometry.chrome.leading.top).toBe(12);
    expect(geometry.chrome.action.right).toBe(16);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(44);
  });

  it("keeps the desktop visual header height while reserving extra leading space for macOS overlay titlebars", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
      overlayTitlebar: true,
    });

    expect(geometry.stage.top).toBe(56);
    expect(geometry.chromeRail.height).toBe(56);
    expect(geometry.chrome.visualHeaderHeight).toBe(56);
    expect(geometry.chrome.leadingSafeInset).toBe(72);
    expect(geometry.chrome.leading.left).toBe(72);
    expect(geometry.chrome.leading.top).toBe(12);
    expect(geometry.chrome.action.right).toBe(16);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(44);
    expect(geometry.diagnostics.top).toBe(64);
  });

  it("keeps the compact macOS overlay contract aligned with the same visual header height", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 620,
      diagnosticsVisible: false,
      overlayTitlebar: true,
    });

    expect(geometry.stage.top).toBe(64);
    expect(geometry.chromeRail.height).toBe(64);
    expect(geometry.chrome.visualHeaderHeight).toBe(64);
    expect(geometry.chrome.leadingSafeInset).toBe(64);
    expect(geometry.chrome.leading.left).toBe(64);
    expect(geometry.chrome.leading.top).toBe(12);
    expect(geometry.chrome.action.right).toBe(12);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(44);
  });

  it("keeps the ultra-compact main-stage contract aligned with the same full-width host", () => {
    const geometry = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 520,
      diagnosticsVisible: false,
    });

    expect(geometry.compact).toBe(true);
    expect(geometry.ultraCompact).toBe(true);
    expect(geometry.stage.left).toBe(0);
    expect(geometry.stage.top).toBe(64);
    expect(geometry.stage.right).toBe(0);
    expect(geometry.stage.bottom).toBe(0);
    expect(geometry.stage.radius).toBe(0);
    expect(geometry.chromeRail.visible).toBe(true);
    expect(geometry.chromeRail.left).toBe(0);
    expect(geometry.chromeRail.right).toBe(0);
    expect(geometry.chromeRail.top).toBe(0);
    expect(geometry.chromeRail.height).toBe(64);
    expect(geometry.chromeRail.radius).toBe(0);
    expect(geometry.host.left).toBe(0);
    expect(geometry.host.top).toBe(0);
    expect(geometry.host.right).toBe(0);
    expect(geometry.host.bottom).toBe(0);
    expect(geometry.diagnostics.compact).toBe(true);
    expect(geometry.diagnostics.top).toBe(66);
    expect(geometry.chrome.visualHeaderHeight).toBe(64);
    expect(geometry.chrome.leadingSafeInset).toBe(12);
    expect(geometry.chrome.leading.left).toBe(12);
    expect(geometry.chrome.leading.top).toBe(12);
    expect(geometry.chrome.action.right).toBe(12);
    expect(geometry.chrome.action.top).toBe(12);
    expect(geometry.chrome.action.size).toBe(44);
  });

  it("keeps desktop diagnostics below the fullscreen chrome without changing the stage contract", () => {
    const hiddenDiagnostics = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: false,
    });
    const visibleDiagnostics = resolveBrowserViewerGeometry({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
    });

    expect(hiddenDiagnostics.stage).toEqual(visibleDiagnostics.stage);
    expect(hiddenDiagnostics.host).toEqual(visibleDiagnostics.host);
    expect(hiddenDiagnostics.chrome).toEqual(visibleDiagnostics.chrome);
    expect(hiddenDiagnostics.chromeRail).toEqual(visibleDiagnostics.chromeRail);
    expect(hiddenDiagnostics.diagnostics.top).toBe(16);
    expect(visibleDiagnostics.diagnostics.top).toBe(64);
  });
});
