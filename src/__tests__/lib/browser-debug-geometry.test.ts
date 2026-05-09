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
    expect(
      createBrowserDebugGeometrySnapshot({
        layoutDiagnostics,
        nativeDiagnostics,
      }),
    ).toEqual({
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
    expect(
      getBrowserGeometryRows({
        layoutDiagnostics: null,
        nativeDiagnostics: null,
      }),
    ).toEqual([]);
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

  it("formats non-finite layout geometry values as n/a", () => {
    expect(
      getBrowserGeometryRows({
        layoutDiagnostics: {
          ...layoutDiagnostics,
          viewport: { width: Number.NaN, height: Number.NEGATIVE_INFINITY },
          overlay: {
            x: Number.NaN,
            y: Number.POSITIVE_INFINITY,
            width: 1000,
            height: 500,
          },
          hostLogical: {
            x: 100,
            y: 50,
            width: Number.NaN,
            height: Number.POSITIVE_INFINITY,
          },
          lane: {
            left: Number.NaN,
            top: 0,
            right: Number.POSITIVE_INFINITY,
            bottom: 500,
          },
        },
        nativeDiagnostics: null,
      }),
    ).toEqual([
      { label: "viewport", value: "n/a x n/a" },
      { label: "overlay", value: "n/a,n/a 1000 x 500" },
      { label: "stage", value: "100,50 500 x 250" },
      { label: "host", value: "100,50 n/a x n/a" },
      { label: "fill", value: "n/a n/a" },
      { label: "lane", value: "Ln/a T0 Rn/a B500" },
    ]);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("formats non-finite native scale factor %s as n/a", (scaleFactor) => {
    expect(
      getBrowserGeometryRows({
        layoutDiagnostics: null,
        nativeDiagnostics: {
          ...nativeDiagnostics,
          scaleFactor,
        },
      }),
    ).toContainEqual({ label: "rust", value: "resize xn/a" });
  });

  it("formats non-finite native geometry values as n/a", () => {
    const rows = getBrowserGeometryRows({
      layoutDiagnostics,
      nativeDiagnostics: {
        ...nativeDiagnostics,
        scaleFactor: Number.POSITIVE_INFINITY,
        nativeWebviewBounds: {
          x: Number.NaN,
          y: Number.POSITIVE_INFINITY,
          width: Number.NEGATIVE_INFINITY,
          height: 250,
        },
      },
    });

    expect(rows).toContainEqual({ label: "rust", value: "resize xn/a" });
    expect(rows).toContainEqual({
      label: "native",
      value: "n/a,n/a n/a x 250",
    });
    expect(rows).toContainEqual({ label: "delta", value: "xn/a yn/a wn/a h0" });
  });
});
