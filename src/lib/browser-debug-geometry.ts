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

export function formatCompactFill(width: number, height: number, totalWidth: number, totalHeight: number) {
  return `${formatRatio(width, totalWidth)} ${formatRatio(height, totalHeight)}`;
}

export function getBrowserGeometryStripItems(snapshot: BrowserDebugGeometrySnapshot, compact: boolean): string[] {
  const fullItems: string[] = [];
  const compactItems: string[] = [];
  const { layoutDiagnostics, nativeDiagnostics } = snapshot;

  if (layoutDiagnostics) {
    const viewportItem = `vp ${layoutDiagnostics.viewport.width}x${layoutDiagnostics.viewport.height}`;
    const hostItem = `host ${layoutDiagnostics.hostLogical.width}x${layoutDiagnostics.hostLogical.height}`;
    const fillItem = `fill ${formatCompactFill(
      layoutDiagnostics.hostLogical.width,
      layoutDiagnostics.hostLogical.height,
      layoutDiagnostics.overlay.width,
      layoutDiagnostics.overlay.height,
    )}`;
    const laneItem = `lane L${layoutDiagnostics.lane.left} T${layoutDiagnostics.lane.top} R${layoutDiagnostics.lane.right} B${layoutDiagnostics.lane.bottom}`;
    fullItems.push(viewportItem, hostItem, fillItem, laneItem);
    compactItems.push(viewportItem, fillItem);
  }

  if (nativeDiagnostics) {
    fullItems.push(
      `rust ${nativeDiagnostics.action} x${nativeDiagnostics.scaleFactor.toFixed(BROWSER_GEOMETRY_SCALE_FACTOR_FRACTION_DIGITS)}`,
    );
    if (nativeDiagnostics.nativeWebviewBounds) {
      const nativeItem = `native ${Math.round(nativeDiagnostics.nativeWebviewBounds.width)}x${Math.round(nativeDiagnostics.nativeWebviewBounds.height)}`;
      fullItems.push(nativeItem);
      compactItems.push(nativeItem);
    }
    if (nativeDiagnostics.nativeWebviewBounds && layoutDiagnostics) {
      const matchItem = `match ${formatCompactFill(
        nativeDiagnostics.nativeWebviewBounds.width,
        nativeDiagnostics.nativeWebviewBounds.height,
        layoutDiagnostics.hostLogical.width,
        layoutDiagnostics.hostLogical.height,
      )}`;
      fullItems.push(matchItem);
      compactItems.push(matchItem);
    }
  }

  return compact ? compactItems : fullItems;
}

export function getBrowserGeometryRows(snapshot: BrowserDebugGeometrySnapshot): BrowserDebugGeometryRow[] {
  const rows: BrowserDebugGeometryRow[] = [];
  const { layoutDiagnostics, nativeDiagnostics } = snapshot;

  if (layoutDiagnostics) {
    rows.push(
      { label: "viewport", value: `${layoutDiagnostics.viewport.width} x ${layoutDiagnostics.viewport.height}` },
      { label: "host", value: `${layoutDiagnostics.hostLogical.width} x ${layoutDiagnostics.hostLogical.height}` },
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
        value: `${Math.round(nativeDiagnostics.nativeWebviewBounds.width)} x ${Math.round(nativeDiagnostics.nativeWebviewBounds.height)}`,
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
    }
  }

  return rows;
}
