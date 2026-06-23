export type BrowserViewerScope = "content-pane" | "main-stage";

export type BrowserViewerGeometryInput = {
  scope: BrowserViewerScope;
  viewportWidth: number;
  diagnosticsVisible: boolean;
  overlayTitlebar?: boolean;
};

export type BrowserViewerGeometry = {
  compact: boolean;
  ultraCompact: boolean;
  chromeRail: {
    visible: boolean;
    left: number;
    right: number;
    top: number;
    height: number;
  };
  stage: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  host: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  chrome: {
    visualHeaderHeight: number;
    leadingSafeInset: number;
    leading: {
      left: number;
      top: number;
    };
    action: {
      right: number;
      top: number;
      size: number;
    };
  };
  diagnostics: {
    compact: boolean;
    top: number;
  };
};

const INVALID_VIEWPORT_WIDTH_FALLBACK = 520;

function normalizeViewportWidth(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth < 0) {
    return INVALID_VIEWPORT_WIDTH_FALLBACK;
  }

  return viewportWidth;
}

function resolveMainStageGeometry(
  viewportWidth: number,
  diagnosticsVisible: boolean,
  overlayTitlebar: boolean,
): BrowserViewerGeometry {
  const normalizedViewportWidth = normalizeViewportWidth(viewportWidth);
  const compact = normalizedViewportWidth <= 768;
  const ultraCompact = normalizedViewportWidth <= 520;
  const chromeHorizontalInset = compact ? 12 : 16;
  const visualHeaderHeight = compact ? 48 : 44;
  const leadingSafeInset = overlayTitlebar ? (compact ? 64 : 72) : chromeHorizontalInset;
  const actionButtonSize = 44;
  const actionVerticalInset = (visualHeaderHeight - actionButtonSize) / 2;
  const leadingVerticalInset = actionVerticalInset;
  const diagnosticsTop = compact ? visualHeaderHeight + 2 : diagnosticsVisible ? visualHeaderHeight + 8 : 16;

  return {
    compact,
    ultraCompact,
    chromeRail: {
      visible: true,
      left: 0,
      right: 0,
      top: 0,
      height: visualHeaderHeight,
    },
    stage: {
      left: 0,
      top: visualHeaderHeight,
      right: 0,
      bottom: 0,
    },
    host: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    chrome: {
      visualHeaderHeight,
      leadingSafeInset,
      leading: {
        left: leadingSafeInset,
        top: leadingVerticalInset,
      },
      action: {
        right: chromeHorizontalInset,
        top: actionVerticalInset,
        size: actionButtonSize,
      },
    },
    diagnostics: {
      compact,
      top: diagnosticsTop,
    },
  };
}

export function resolveBrowserViewerGeometry({
  scope,
  viewportWidth,
  diagnosticsVisible,
  overlayTitlebar = false,
}: BrowserViewerGeometryInput): BrowserViewerGeometry {
  if (scope === "main-stage") {
    return resolveMainStageGeometry(viewportWidth, diagnosticsVisible, overlayTitlebar);
  }

  return {
    compact: false,
    ultraCompact: false,
    chromeRail: {
      visible: false,
      left: 16,
      right: 16,
      top: 16,
      height: 46,
    },
    stage: {
      left: 16,
      top: diagnosticsVisible ? 56 : 16,
      right: 16,
      bottom: 16,
    },
    host: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    chrome: {
      visualHeaderHeight: 46,
      leadingSafeInset: 16,
      leading: {
        left: 16,
        top: 16,
      },
      action: {
        right: 16,
        top: 16,
        size: 46,
      },
    },
    diagnostics: {
      compact: false,
      top: 16,
    },
  };
}
