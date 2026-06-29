import { READER_CHROME_HEIGHT_PX } from "@/constants/ui-layout";

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
const DESKTOP_OVERLAY_TITLEBAR_OFFSET = 44;

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
  const visualHeaderHeight = READER_CHROME_HEIGHT_PX;
  const titlebarTopInset = overlayTitlebar ? DESKTOP_OVERLAY_TITLEBAR_OFFSET : 0;
  const leadingSafeInset = overlayTitlebar ? (compact ? 64 : 72) : chromeHorizontalInset;
  const actionButtonSize = 44;
  const actionVerticalInset = (visualHeaderHeight - actionButtonSize) / 2;
  const leadingVerticalInset = actionVerticalInset;
  const chromeTop = titlebarTopInset;
  const hostTop = chromeTop + visualHeaderHeight;
  const diagnosticsTop = compact ? hostTop + 2 : diagnosticsVisible ? hostTop + 8 : titlebarTopInset + 16;

  return {
    compact,
    ultraCompact,
    chromeRail: {
      visible: true,
      left: 0,
      right: 0,
      top: chromeTop,
      height: visualHeaderHeight,
    },
    stage: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    host: {
      left: 0,
      top: hostTop,
      right: 0,
      bottom: 0,
    },
    chrome: {
      visualHeaderHeight,
      leadingSafeInset,
      leading: {
        left: leadingSafeInset,
        top: chromeTop + leadingVerticalInset,
      },
      action: {
        right: chromeHorizontalInset,
        top: chromeTop + actionVerticalInset,
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
      visible: true,
      left: 0,
      right: 0,
      top: 0,
      height: READER_CHROME_HEIGHT_PX,
    },
    stage: {
      left: 0,
      top: diagnosticsVisible ? 48 : 0,
      right: 0,
      bottom: 0,
    },
    host: {
      left: 0,
      top: READER_CHROME_HEIGHT_PX,
      right: 0,
      bottom: 0,
    },
    chrome: {
      visualHeaderHeight: READER_CHROME_HEIGHT_PX,
      leadingSafeInset: 16,
      leading: {
        left: 12,
        top: 2,
      },
      action: {
        right: 12,
        top: 2,
        size: 44,
      },
    },
    diagnostics: {
      compact: false,
      top: 16,
    },
  };
}
