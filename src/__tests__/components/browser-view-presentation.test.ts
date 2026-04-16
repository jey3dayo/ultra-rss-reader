import { describe, expect, it } from "vitest";
import { resolveBrowserViewPresentation } from "@/components/reader/browser-view-presentation";

describe("browser-view-presentation", () => {
  it("returns compact main-stage geometry with compact semantic surfaces", () => {
    const presentation = resolveBrowserViewPresentation({
      scope: "main-stage",
      viewportWidth: 500,
      diagnosticsVisible: false,
    });

    expect(presentation.geometry.compact).toBe(true);
    expect(presentation.geometry.stage.top).toBe(64);
    expect(presentation.leadingActionSurface).toEqual({
      compact: true,
      tone: "default",
    });
    expect(presentation.actionButtonSurface).toEqual({
      compact: true,
      tone: "default",
    });
    expect(presentation.stageSurface).toEqual({
      scope: "main-stage",
    });
  });

  it("keeps the visual header height stable while macOS overlay titlebar increases only the leading safe inset", () => {
    const standard = resolveBrowserViewPresentation({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
    });
    const overlayTitlebar = resolveBrowserViewPresentation({
      scope: "main-stage",
      viewportWidth: 1280,
      diagnosticsVisible: true,
      overlayTitlebar: true,
    });

    expect(overlayTitlebar.geometry.stage.top).toBe(standard.geometry.stage.top);
    expect(overlayTitlebar.geometry.chrome.visualHeaderHeight).toBe(standard.geometry.chrome.visualHeaderHeight);
    expect(overlayTitlebar.geometry.chrome.leadingSafeInset).toBeGreaterThan(standard.geometry.chrome.leadingSafeInset);
    expect(overlayTitlebar.leadingActionSurface).toEqual({
      compact: true,
      tone: "default",
    });
  });

  it("returns content-pane geometry with the inset stage surface presentation", () => {
    const presentation = resolveBrowserViewPresentation({
      scope: "content-pane",
      viewportWidth: 1200,
      diagnosticsVisible: true,
    });

    expect(presentation.geometry.compact).toBe(false);
    expect(presentation.geometry.stage.top).toBe(56);
    expect(presentation.leadingActionSurface).toEqual({
      compact: true,
      tone: "default",
    });
    expect(presentation.actionButtonSurface).toEqual({
      compact: true,
      tone: "default",
    });
    expect(presentation.stageSurface).toEqual({
      scope: "content-pane",
    });
  });
});
