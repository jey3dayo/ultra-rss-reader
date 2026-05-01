import { describe, expect, it } from "vitest";
import { getBrowserGeometryRows } from "@/lib/browser-debug-geometry";

const layoutDiagnostics = {
  viewport: { width: 1200, height: 800 },
  overlay: { x: 0, y: 0, width: 1000, height: 500 },
  hostLogical: { x: 100, y: 50, width: 500, height: 250 },
  stage: { x: 0, y: 0, width: 1000, height: 500 },
  lane: { left: 100, top: 0, right: 600, bottom: 500 },
};

const nativeDiagnostics = {
  action: "resize",
  requestedLogical: { x: 100, y: 50, width: 500, height: 250 },
  appliedLogical: { x: 100, y: 50, width: 500, height: 250 },
  scaleFactor: 2,
  nativeWebviewBounds: { x: 200, y: 100, width: 1000, height: 500 },
};

describe("browser-debug-geometry", () => {
  it("formats layout diagnostics rows", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics, nativeDiagnostics: null })).toEqual([
      { label: "viewport", value: "1200 x 800" },
      { label: "host", value: "500 x 250" },
      { label: "fill", value: "50.0% 50.0%" },
      { label: "lane", value: "L100 T0 R600 B500" },
    ]);
  });

  it("formats native diagnostics rows", () => {
    expect(getBrowserGeometryRows({ layoutDiagnostics: null, nativeDiagnostics })).toEqual([
      { label: "rust", value: "resize x2.00" },
      { label: "native", value: "1000 x 500" },
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
      value: "200.0% 200.0%",
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
