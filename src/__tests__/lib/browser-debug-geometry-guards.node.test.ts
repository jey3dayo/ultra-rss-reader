import { describe, expect, it } from "vitest";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
  BrowserDebugGeometrySnapshot,
} from "@/lib/browser/browser-debug-geometry";
import {
  isBrowserDebugGeometryDetail,
  isBrowserDebugGeometrySnapshot,
} from "@/lib/browser/browser-debug-geometry-guards";

const rect = { x: 100, y: 50, width: 500, height: 250 };

function createLayoutDiagnostics(
  overrides: Partial<BrowserDebugGeometryLayoutDiagnostics> = {},
): BrowserDebugGeometryLayoutDiagnostics {
  return {
    viewport: { width: 1200, height: 800 },
    overlay: { x: 0, y: 0, width: 1000, height: 500 },
    hostLogical: rect,
    stage: rect,
    lane: { left: 100, top: 0, right: 600, bottom: 500 },
    ...overrides,
  };
}

function createNativeDiagnostics(
  overrides: Partial<BrowserDebugGeometryNativeDiagnostics> = {},
): BrowserDebugGeometryNativeDiagnostics {
  return {
    action: "resize",
    requestedLogical: rect,
    appliedLogical: rect,
    scaleFactor: 2,
    nativeWebviewBounds: rect,
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<BrowserDebugGeometrySnapshot> = {}): BrowserDebugGeometrySnapshot {
  return {
    layoutDiagnostics: createLayoutDiagnostics(),
    nativeDiagnostics: createNativeDiagnostics(),
    ...overrides,
  };
}

function createUnknownLayoutDiagnostics(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createLayoutDiagnostics(),
    ...overrides,
  };
}

function createUnknownNativeDiagnostics(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...createNativeDiagnostics(),
    ...overrides,
  };
}

function createUnknownSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    layoutDiagnostics: createLayoutDiagnostics(),
    nativeDiagnostics: createNativeDiagnostics(),
    ...overrides,
  };
}

describe("browser-debug-geometry-guards", () => {
  it("accepts valid geometry event details", () => {
    const snapshot = createSnapshot();

    expect(isBrowserDebugGeometrySnapshot(snapshot)).toBe(true);
    expect(isBrowserDebugGeometryDetail(snapshot)).toBe(true);
    expect(isBrowserDebugGeometryDetail(null)).toBe(true);
  });

  it.each([
    ["null snapshot", null],
    ["array", []],
    ["missing native diagnostics key", { layoutDiagnostics: null }],
    ["missing layout diagnostics key", { nativeDiagnostics: null }],
    [
      "invalid layout viewport",
      createUnknownSnapshot({
        layoutDiagnostics: createUnknownLayoutDiagnostics({
          viewport: { width: "1200", height: 800 },
        }),
      }),
    ],
    [
      "invalid layout lane",
      createUnknownSnapshot({
        layoutDiagnostics: createUnknownLayoutDiagnostics({
          lane: { ...createLayoutDiagnostics().lane, left: null },
        }),
      }),
    ],
    [
      "invalid native action",
      createUnknownSnapshot({
        nativeDiagnostics: createUnknownNativeDiagnostics({ action: 1 }),
      }),
    ],
    [
      "invalid native bounds",
      createUnknownSnapshot({
        nativeDiagnostics: createUnknownNativeDiagnostics({
          nativeWebviewBounds: [],
        }),
      }),
    ],
  ])("rejects malformed geometry snapshots: %s", (_label, value) => {
    expect(isBrowserDebugGeometrySnapshot(value)).toBe(false);
  });

  it("rejects malformed geometry event details", () => {
    expect(isBrowserDebugGeometryDetail({ layoutDiagnostics: null })).toBe(false);
    expect(isBrowserDebugGeometryDetail([])).toBe(false);
  });

  it("accepts non-finite geometry numbers at the type-guard boundary", () => {
    expect(
      isBrowserDebugGeometrySnapshot(
        createSnapshot({
          layoutDiagnostics: createLayoutDiagnostics({
            viewport: { width: Number.NaN, height: Number.NEGATIVE_INFINITY },
            overlay: {
              x: Number.NaN,
              y: Number.POSITIVE_INFINITY,
              width: 1000,
              height: 500,
            },
          }),
          nativeDiagnostics: createNativeDiagnostics({
            scaleFactor: Number.POSITIVE_INFINITY,
            nativeWebviewBounds: {
              x: Number.NaN,
              y: Number.POSITIVE_INFINITY,
              width: Number.NEGATIVE_INFINITY,
              height: 250,
            },
          }),
        }),
      ),
    ).toBe(true);
  });
});
