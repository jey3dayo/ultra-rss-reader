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
  host: {
    left: number;
    top: number;
    right: number;
    bottom: number;
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
  const chromeHorizontalInset = compact ? 12 : 16;
  const chromeVerticalInset = 12;
  const buttonSize = 44;
  const hostTopInset = compact ? chromeVerticalInset + buttonSize + 8 : 56;
  const diagnosticsTop = compact ? hostTopInset + 2 : diagnosticsVisible ? hostTopInset + 8 : 16;

  return {
    compact,
    ultraCompact,
    chromeRail: {
      visible: true,
      left: 0,
      right: 0,
      top: 0,
      height: hostTopInset,
      radius: 0,
    },
    stage: {
      left: 0,
      top: hostTopInset,
      right: 0,
      bottom: 0,
      radius: 0,
    },
    host: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    chrome: {
      close: {
        left: chromeHorizontalInset,
        top: chromeVerticalInset,
        size: buttonSize,
      },
      action: {
        right: chromeHorizontalInset,
        top: chromeVerticalInset,
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
    host: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
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
