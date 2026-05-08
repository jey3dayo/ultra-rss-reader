import { describe, expect, it } from "vitest";
import { createBrowserDebugGeometrySnapshot, getBrowserGeometryRows } from "@/lib/browser/browser-debug-geometry";

const layoutDiagnostics = {
  viewport: { width: 1200, height: 800 },
  overlay: { x: 0, y: 0, width: 1000, height: 500 },
  hostLogical: { x: 100, y: 50, width: 500, height: 250 },
  stage: { x: 100, y: 50, width: 500, height: 250 },
  lane: { left: 100, top: 0, right: 600, bottom: 500 },
};

const nativeDiagnostics = {
  action: "resize",
  requestedLogical: { x: 100, y: 50, width: 500, height: 250 },
  appliedLogical: { x: 100, y: 50, width: 500, height: 250 },
  scaleFactor: 2,
  nativeWebviewBounds: { x: 100, y: 50, width: 500, height: 250 },
};

describe("browser-debug-geometry", () => {
  it("creates a diagnostics snapshot separately from row rendering", () => {
    expect(createBrowserDebugGeometrySnapshot({ layoutDiagnostics, nativeDiagnostics })).toEqual({
      layoutDiagnostics,
      nativeDiagnostics,
    });
  });

  it("formats layout diagnostics rows", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics, nativeDiagnostics: null })).toEqual([
      { label: "viewport", value: "1200 x 800" },
      { label: "overlay", value: "0,0 1000 x 500" },
      { label: "stage", value: "100,50 500 x 250" },
      { label: "host", value: "100,50 500 x 250" },
      { label: "fill", value: "50.0% 50.0%" },
      { label: "lane", value: "L100 T0 R600 B500" },
    ]);
  });

  it("formats native diagnostics rows", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics: null, nativeDiagnostics })).toEqual([
      { label: "rust", value: "resize x2.00" },
      { label: "native", value: "100,50 500 x 250" },
    ]);
  });

  it("omits native bounds rows when native bounds are unavailable", () => {
    expect(
      getBrowserGeometryRows({
        layoutDiagnostics: null,
        nativeDiagnostics: {
          ...nativeDiagnostics,
          nativeWebviewBounds: null,
        },
      }),
    ).toEqual([{ label: "rust", value: "resize x2.00" }]);
  });

  it("returns no rows when diagnostics are unavailable", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics: null, nativeDiagnostics: null })).toEqual([]);
  });

  it("formats match rows when layout and native diagnostics are both available", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics, nativeDiagnostics })).toContainEqual({
      label: "match",
      value: "100.0% 100.0%",
    });
    expect(getBrowserGeometryRows({ layoutDiagnostics, nativeDiagnostics })).toContainEqual({
      label: "delta",
      value: "x0 y0 w0 h0",
    });
  });

  it("uses n/a fill values when totals are not positive", () => {
    expect(
      getBrowserGeometryRows({
        layoutDiagnostics: {
          ...layoutDiagnostics,
          overlay: { x: 0, y: 0, width: 0, height: 0 },
        },
        nativeDiagnostics: null,
      }),
    ).toContainEqual({ label: "fill", value: "n/a n/a" });
  });
});
