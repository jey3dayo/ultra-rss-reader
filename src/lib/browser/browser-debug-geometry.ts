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

export function createBrowserDebugGeometrySnapshot(
  snapshot: BrowserDebugGeometrySnapshot,
): BrowserDebugGeometrySnapshot {
  return snapshot;
}

function formatRatio(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return "n/a";
  }

  return `${((value / total) * 100).toFixed(BROWSER_GEOMETRY_PERCENT_FRACTION_DIGITS)}%`;
}

function formatCompactFill(width: number, height: number, totalWidth: number, totalHeight: number) {
  return `${formatRatio(width, totalWidth)} ${formatRatio(height, totalHeight)}`;
}

function formatDimensions(width: number, height: number) {
  return `${formatRoundedNumber(width)} x ${formatRoundedNumber(height)}`;
}

function formatRect(rect: BrowserDebugGeometryRect) {
  return `${formatRoundedNumber(rect.x)},${formatRoundedNumber(rect.y)} ${formatDimensions(rect.width, rect.height)}`;
}

function formatRectDelta(from: BrowserDebugGeometryRect, to: BrowserDebugGeometryRect) {
  return `x${formatRoundedNumber(to.x - from.x)} y${formatRoundedNumber(to.y - from.y)} w${formatRoundedNumber(to.width - from.width)} h${formatRoundedNumber(to.height - from.height)}`;
}

function formatRoundedNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return String(Math.round(value));
}

function formatScaleFactor(value: number) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  return value.toFixed(BROWSER_GEOMETRY_SCALE_FACTOR_FRACTION_DIGITS);
}

function formatLane(lane: BrowserDebugGeometryLayoutDiagnostics["lane"]) {
  return `L${formatRoundedNumber(lane.left)} T${formatRoundedNumber(lane.top)} R${formatRoundedNumber(lane.right)} B${formatRoundedNumber(lane.bottom)}`;
}

export function getBrowserGeometryRows(snapshot: BrowserDebugGeometrySnapshot): BrowserDebugGeometryRow[] {
  const rows: BrowserDebugGeometryRow[] = [];
  const { layoutDiagnostics, nativeDiagnostics } = snapshot;

  if (layoutDiagnostics) {
    rows.push(
      {
        label: "viewport",
        value: formatDimensions(layoutDiagnostics.viewport.width, layoutDiagnostics.viewport.height),
      },
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
        value: formatLane(layoutDiagnostics.lane),
      },
    );
  }

  if (nativeDiagnostics) {
    rows.push({
      label: "rust",
      value: `${nativeDiagnostics.action} x${formatScaleFactor(nativeDiagnostics.scaleFactor)}`,
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
