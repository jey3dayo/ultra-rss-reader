import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
  BrowserDebugGeometrySnapshot,
} from "@/lib/browser/browser-debug-geometry";
import { isNumberValue, isRecord } from "@/lib/type-guards";

type BrowserDebugGeometryRect = BrowserDebugGeometryNativeDiagnostics["requestedLogical"];

function isBrowserDebugGeometryRect(value: unknown): value is BrowserDebugGeometryRect {
  return (
    isRecord(value) &&
    isNumberValue(value.x) &&
    isNumberValue(value.y) &&
    isNumberValue(value.width) &&
    isNumberValue(value.height)
  );
}

function isBrowserDebugGeometryViewport(value: unknown): value is BrowserDebugGeometryLayoutDiagnostics["viewport"] {
  return isRecord(value) && isNumberValue(value.width) && isNumberValue(value.height);
}

function isBrowserDebugGeometryLane(value: unknown): value is BrowserDebugGeometryLayoutDiagnostics["lane"] {
  return (
    isRecord(value) &&
    isNumberValue(value.left) &&
    isNumberValue(value.top) &&
    isNumberValue(value.right) &&
    isNumberValue(value.bottom)
  );
}

function isBrowserDebugGeometryLayoutDiagnostics(value: unknown): value is BrowserDebugGeometryLayoutDiagnostics {
  return (
    isRecord(value) &&
    isBrowserDebugGeometryViewport(value.viewport) &&
    isBrowserDebugGeometryRect(value.overlay) &&
    isBrowserDebugGeometryRect(value.hostLogical) &&
    isBrowserDebugGeometryRect(value.stage) &&
    isBrowserDebugGeometryLane(value.lane)
  );
}

function isBrowserDebugGeometryNativeDiagnostics(value: unknown): value is BrowserDebugGeometryNativeDiagnostics {
  return (
    isRecord(value) &&
    typeof value.action === "string" &&
    isBrowserDebugGeometryRect(value.requestedLogical) &&
    isBrowserDebugGeometryRect(value.appliedLogical) &&
    isNumberValue(value.scaleFactor) &&
    (value.nativeWebviewBounds === null || isBrowserDebugGeometryRect(value.nativeWebviewBounds))
  );
}

export function isBrowserDebugGeometrySnapshot(value: unknown): value is BrowserDebugGeometrySnapshot {
  return (
    isRecord(value) &&
    (value.layoutDiagnostics === null || isBrowserDebugGeometryLayoutDiagnostics(value.layoutDiagnostics)) &&
    (value.nativeDiagnostics === null || isBrowserDebugGeometryNativeDiagnostics(value.nativeDiagnostics))
  );
}

export function isBrowserDebugGeometryDetail(value: unknown): value is BrowserDebugGeometrySnapshot | null {
  return value === null || isBrowserDebugGeometrySnapshot(value);
}
