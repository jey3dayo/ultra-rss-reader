export type BrowserViewerScope = "content-pane" | "main-stage";

export type BrowserViewerGeometryInput = {
  scope: BrowserViewerScope;
  viewportWidth: number;
  diagnosticsVisible: boolean;
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
    radius: number;
  };
  stage: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    radius: number;
  };
  chrome: {
    close: {
      left: number;
      top: number;
      size: number;
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

function resolveMainStageGeometry(viewportWidth: number, diagnosticsVisible: boolean): BrowserViewerGeometry {
  const compact = viewportWidth <= 768;
  const ultraCompact = viewportWidth <= 520;
  const edgeInset = ultraCompact ? 10 : compact ? 12 : 16;
  const chromeInset = compact ? 12 : 16;
  const buttonSize = compact ? 40 : 46;
  const chromeLaneBottom = compact ? chromeInset + buttonSize + 8 : edgeInset;
  const diagnosticsTop = compact ? chromeLaneBottom + 2 : 16;
  const diagnosticsReservedTop = diagnosticsVisible ? (compact ? chromeLaneBottom + 34 : 54) : chromeLaneBottom;

  return {
    compact,
    ultraCompact,
    chromeRail: {
      visible: compact,
      left: chromeInset,
      right: chromeInset,
      top: chromeInset,
      height: buttonSize,
      radius: ultraCompact ? 16 : 18,
    },
    stage: {
      left: edgeInset,
      top: diagnosticsReservedTop,
      right: edgeInset,
      bottom: edgeInset,
      radius: ultraCompact ? 18 : compact ? 20 : 24,
    },
    chrome: {
      close: {
        left: chromeInset,
        top: chromeInset,
        size: buttonSize,
      },
      action: {
        right: chromeInset,
        top: chromeInset,
        size: buttonSize,
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
}: BrowserViewerGeometryInput): BrowserViewerGeometry {
  if (scope === "main-stage") {
    return resolveMainStageGeometry(viewportWidth, diagnosticsVisible);
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
      radius: 18,
    },
    stage: {
      left: 16,
      top: diagnosticsVisible ? 56 : 16,
      right: 16,
      bottom: 16,
      radius: 20,
    },
    chrome: {
      close: {
        left: 16,
        top: 16,
        size: 46,
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
