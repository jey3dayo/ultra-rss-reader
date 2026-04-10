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

function resolveMainStageGeometry(viewportWidth: number): BrowserViewerGeometry {
  const compact = viewportWidth <= 768;
  const ultraCompact = viewportWidth <= 520;
  const chromeInset = compact ? 12 : 16;
  const buttonSize = compact ? 40 : 46;
  const chromeLaneBottom = compact ? chromeInset + buttonSize + 8 : 16;
  const diagnosticsTop = compact ? chromeLaneBottom + 2 : 16;

  return {
    compact,
    ultraCompact,
    chromeRail: {
      visible: false,
      left: 0,
      right: 0,
      top: 0,
      height: 0,
      radius: 0,
    },
    stage: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      radius: 0,
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
    return resolveMainStageGeometry(viewportWidth);
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
