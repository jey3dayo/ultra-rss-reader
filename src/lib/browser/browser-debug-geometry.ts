import {
  BROWSER_GEOMETRY_PERCENT_FRACTION_DIGITS,
  BROWSER_GEOMETRY_SCALE_FACTOR_FRACTION_DIGITS,
} from "@/constants/browser";

export type BrowserDebugGeometryNativeDiagnostics = {
  action: string;
  requestedLogical: BrowserDebugGeometryRect;
  appliedLogical: BrowserDebugGeometryRect;
  scaleFactor: number;
  nativeWebviewBounds: BrowserDebugGeometryRect | null;
};

export type BrowserDebugGeometryRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserDebugGeometryLayoutDiagnostics = {
  viewport: {
    width: number;
    height: number;
  };
  overlay: BrowserDebugGeometryRect;
  hostLogical: BrowserDebugGeometryRect;
  stage: BrowserDebugGeometryRect;
  lane: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

export type BrowserDebugGeometrySnapshot = {
  layoutDiagnostics: BrowserDebugGeometryLayoutDiagnostics | null;
  nativeDiagnostics: BrowserDebugGeometryNativeDiagnostics | null;
};

export type BrowserDebugGeometryRow = {
  label: string;
  value: string;
};

function formatRatio(value: number, total: number) {
  if (total <= 0) {
    return "n/a";
  }

  return `${((value / total) * 100).toFixed(BROWSER_GEOMETRY_PERCENT_FRACTION_DIGITS)}%`;
}

function formatCompactFill(width: number, height: number, totalWidth: number, totalHeight: number) {
  return `${formatRatio(width, totalWidth)} ${formatRatio(height, totalHeight)}`;
}

function formatRect(rect: BrowserDebugGeometryRect) {
  return `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)} x ${Math.round(rect.height)}`;
}

function formatRectDelta(from: BrowserDebugGeometryRect, to: BrowserDebugGeometryRect) {
  return `x${Math.round(to.x - from.x)} y${Math.round(to.y - from.y)} w${Math.round(to.width - from.width)} h${Math.round(to.height - from.height)}`;
}

export function getBrowserGeometryRows(snapshot: BrowserDebugGeometrySnapshot): BrowserDebugGeometryRow[] {
  const rows: BrowserDebugGeometryRow[] = [];
  const { layoutDiagnostics, nativeDiagnostics } = snapshot;

  if (layoutDiagnostics) {
    rows.push(
      { label: "viewport", value: `${layoutDiagnostics.viewport.width} x ${layoutDiagnostics.viewport.height}` },
      { label: "overlay", value: formatRect(layoutDiagnostics.overlay) },
      { label: "stage", value: formatRect(layoutDiagnostics.stage) },
      { label: "host", value: formatRect(layoutDiagnostics.hostLogical) },
      {
        label: "fill",
        value: formatCompactFill(
          layoutDiagnostics.hostLogical.width,
          layoutDiagnostics.hostLogical.height,
          layoutDiagnostics.overlay.width,
          layoutDiagnostics.overlay.height,
        ),
      },
      {
        label: "lane",
        value: `L${layoutDiagnostics.lane.left} T${layoutDiagnostics.lane.top} R${layoutDiagnostics.lane.right} B${layoutDiagnostics.lane.bottom}`,
      },
    );
  }

  if (nativeDiagnostics) {
    rows.push({
      label: "rust",
      value: `${nativeDiagnostics.action} x${nativeDiagnostics.scaleFactor.toFixed(BROWSER_GEOMETRY_SCALE_FACTOR_FRACTION_DIGITS)}`,
    });
    if (nativeDiagnostics.nativeWebviewBounds) {
      rows.push({
        label: "native",
        value: formatRect(nativeDiagnostics.nativeWebviewBounds),
      });
    }
    if (nativeDiagnostics.nativeWebviewBounds && layoutDiagnostics) {
      rows.push({
        label: "match",
        value: formatCompactFill(
          nativeDiagnostics.nativeWebviewBounds.width,
          nativeDiagnostics.nativeWebviewBounds.height,
          layoutDiagnostics.hostLogical.width,
          layoutDiagnostics.hostLogical.height,
        ),
      });
      rows.push({
        label: "delta",
        value: formatRectDelta(layoutDiagnostics.hostLogical, nativeDiagnostics.nativeWebviewBounds),
      });
    }
  }

  return rows;
}
