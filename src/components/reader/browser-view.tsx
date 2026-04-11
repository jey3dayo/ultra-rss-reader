import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { CircleAlert, ExternalLink, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  type AppError,
  type BrowserWebviewState,
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  openInBrowser,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import { IconToolbarButton } from "@/components/shared/icon-toolbar-control";
import { Button } from "@/components/ui/button";
import { BROWSER_WINDOW_EVENTS, BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";
import { hasTauriRuntime } from "@/lib/window-chrome";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function initialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
  };
}

function mergeBrowserState(
  previousState: BrowserWebviewState | null,
  nextState: BrowserWebviewState,
  intendedUrl: string,
): BrowserWebviewState {
  if (!previousState) {
    return nextState;
  }

  if (!previousState.is_loading && nextState.is_loading && previousState.url !== nextState.url) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  if (
    previousState.is_loading &&
    nextState.is_loading &&
    previousState.url === intendedUrl &&
    nextState.url !== intendedUrl
  ) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  return nextState;
}

type BrowserWebviewFallbackPayload = {
  url: string;
  opened_external: boolean;
  error_message: string | null;
};

type BrowserWebviewDiagnosticsPayload = {
  action: string;
  requestedLogical: BrowserWebviewBounds;
  appliedLogical: BrowserWebviewBounds;
  scaleFactor: number;
  nativeWebviewBounds: BrowserWebviewBounds | null;
};

type BrowserViewLayoutDiagnostics = {
  viewport: {
    width: number;
    height: number;
  };
  overlay: BrowserWebviewBounds;
  hostLogical: BrowserWebviewBounds;
  stage: BrowserWebviewBounds;
  lane: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

function formatRatio(value: number, total: number) {
  if (total <= 0) {
    return "n/a";
  }

  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatCompactFill(width: number, height: number, totalWidth: number, totalHeight: number) {
  return `${formatRatio(width, totalWidth)} ${formatRatio(height, totalHeight)}`;
}

type BrowserSurfaceIssue = {
  kind: "failed" | "unsupported";
  title: string;
  description: string;
  detail?: string | null;
  canRetry?: boolean;
};

type BrowserViewProps = {
  scope?: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
};

function BrowserDiagnosticsRail({
  layoutDiagnostics,
  nativeDiagnostics,
  compact,
  top,
}: {
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  compact: boolean;
  top: number;
}) {
  const fullItems: string[] = [];
  const compactItems: string[] = [];

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
    fullItems.push(`rust ${nativeDiagnostics.action} x${nativeDiagnostics.scaleFactor.toFixed(2)}`);
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

  const items = compact ? compactItems : fullItems;

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="browser-overlay-diagnostics"
      style={{ top: `${top}px` }}
      className={
        compact
          ? "pointer-events-none absolute left-1/2 z-[90] w-[calc(100vw-7.5rem)] max-w-[calc(100vw-7.5rem)] -translate-x-1/2"
          : "pointer-events-none absolute left-1/2 z-[90] w-[min(780px,calc(100vw-11rem))] -translate-x-1/2"
      }
    >
      <div
        className={
          compact
            ? "mx-auto flex min-w-0 max-w-full items-center justify-start gap-2 overflow-x-auto rounded-2xl border border-white/12 bg-black/68 px-3 py-1.5 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
            : "mx-auto flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/12 bg-black/62 px-4 py-2 whitespace-nowrap font-mono text-[10px] leading-4 text-white/96 shadow-[0_16px_36px_rgba(0,0,0,0.46)] backdrop-blur-xl [text-shadow:0_1px_8px_rgba(0,0,0,0.72)]"
        }
      >
        {items.map((item, index) => (
          <span key={item} className="contents">
            <span className="shrink-0">{item}</span>
            {index < items.length - 1 ? <span className="shrink-0 text-white/44">•</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels }: BrowserViewProps) {
  const prefs = usePreferencesStore((s) => s.prefs);
  const { t } = useTranslation("reader");
  const showDiagnostics = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const browserUrl = useUiStore((s) => s.browserUrl);
  const showToast = useUiStore((s) => s.showToast);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const browserStateRef = useRef<BrowserWebviewState | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const unlistenRef = useRef<Array<() => void>>([]);
  const fallbackInFlightRef = useRef(false);
  const webviewCreatedRef = useRef(false);
  const createInFlightRef = useRef(false);
  const pendingBoundsRef = useRef<BrowserWebviewBounds | null>(null);
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<BrowserViewLayoutDiagnostics | null>(null);
  const [nativeDiagnostics, setNativeDiagnostics] = useState<BrowserWebviewDiagnosticsPayload | null>(null);
  const [surfaceIssue, setSurfaceIssue] = useState<BrowserSurfaceIssue | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1400 : window.innerWidth));

  const handleCloseOverlay = useCallback(() => {
    onCloseOverlay();
  }, [onCloseOverlay]);

  const captureLayoutDiagnostics = useCallback(() => {
    if (!showDiagnostics) {
      return;
    }

    const overlayRect = overlayRef.current?.getBoundingClientRect();
    const stageRect = stageRef.current?.getBoundingClientRect();
    const hostRect = hostRef.current?.getBoundingClientRect();
    const overlayBounds = overlayRect ? toBrowserWebviewBounds(overlayRect) : null;
    const stageBounds = stageRect ? toBrowserWebviewBounds(stageRect) : null;
    const hostBounds = hostRect ? toBrowserWebviewBounds(hostRect) : null;
    if (!overlayRect || !stageRect || !hostRect || !overlayBounds || !stageBounds || !hostBounds) {
      return;
    }

    setLayoutDiagnostics({
      viewport: {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      },
      overlay: overlayBounds,
      hostLogical: hostBounds,
      stage: stageBounds,
      lane: {
        left: Math.round(stageRect.left - overlayRect.left),
        top: Math.round(stageRect.top - overlayRect.top),
        right: Math.round(overlayRect.right - stageRect.right),
        bottom: Math.round(overlayRect.bottom - stageRect.bottom),
      },
    });
  }, [showDiagnostics]);

  const showSurfaceFailure = useCallback(
    (error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open embedded browser webview:", error);
      setSurfaceIssue({
        kind: "failed",
        title: t("browser_embed_failed"),
        description: t("browser_embed_failed_hint"),
        detail: error.message,
        canRetry: true,
      });
      setBrowserState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        const nextState = { ...currentState, is_loading: false };
        browserStateRef.current = nextState;
        return nextState;
      });
    },
    [t],
  );

  useLayoutEffect(() => {
    let cancelled = false;

    listenerReadyRef.current = Promise.all([
      listen<BrowserWebviewState>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
        if (cancelled) return;
        const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
        browserStateRef.current = nextState;
        setBrowserState(nextState);
        setSurfaceIssue(null);
        fallbackInFlightRef.current = false;
      }),
      listen<BrowserWebviewFallbackPayload>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
        if (cancelled) return;
        setSurfaceIssue({
          kind: payload.error_message ? "failed" : "unsupported",
          title: payload.error_message ? t("browser_embed_failed") : t("browser_embed_blocked"),
          description: payload.error_message ? t("browser_embed_failed_hint") : t("browser_embed_blocked_hint"),
          detail: payload.error_message,
          canRetry: Boolean(payload.error_message),
        });
        setBrowserState((currentState) => {
          if (!currentState) {
            return currentState;
          }
          const nextState = { ...currentState, is_loading: false };
          browserStateRef.current = nextState;
          return nextState;
        });
      }),
      listen(BROWSER_WINDOW_EVENTS.closed, () => {
        if (cancelled) return;
        useUiStore.getState().closeBrowser();
      }),
      ...(showDiagnostics
        ? [
            listen<BrowserWebviewDiagnosticsPayload>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
              if (cancelled) return;
              setNativeDiagnostics(payload);
            }),
          ]
        : []),
    ]).then((cleanups) => {
      if (cancelled) {
        cleanups.forEach((cleanup) => {
          cleanup();
        });
        return;
      }
      unlistenRef.current = cleanups;
    });

    return () => {
      cancelled = true;
      unlistenRef.current.forEach((cleanup) => {
        cleanup();
      });
      unlistenRef.current = [];
      listenerReadyRef.current = null;
    };
  }, [showDiagnostics, t]);

  const syncBrowserBounds = useCallback(async (bounds: BrowserWebviewBounds) => {
    const result = await setBrowserWebviewBounds(bounds);
    if (Result.isFailure(result)) {
      console.error("Failed to sync embedded browser bounds:", Result.unwrapError(result));
    }
  }, []);

  const flushPendingBounds = useCallback(
    async (requestedUrl: string) => {
      if (
        createInFlightRef.current ||
        !webviewCreatedRef.current ||
        useUiStore.getState().browserUrl !== requestedUrl
      ) {
        return;
      }

      const pendingBounds = pendingBoundsRef.current;
      if (!pendingBounds) {
        return;
      }

      pendingBoundsRef.current = null;
      await syncBrowserBounds(pendingBounds);
    },
    [syncBrowserBounds],
  );

  const syncBrowserWebview = useCallback(
    async (requestedUrl: string, mode: "create" | "resize") => {
      const rect = hostRef.current?.getBoundingClientRect();
      const bounds = rect ? toBrowserWebviewBounds(rect) : null;
      if (!bounds) {
        return;
      }

      captureLayoutDiagnostics();

      if (mode === "resize") {
        if (createInFlightRef.current || !webviewCreatedRef.current) {
          pendingBoundsRef.current = bounds;
          return;
        }

        await syncBrowserBounds(bounds);
        return;
      }

      if (createInFlightRef.current) {
        pendingBoundsRef.current = bounds;
        return;
      }

      createInFlightRef.current = true;
      const result = await createOrUpdateBrowserWebview(requestedUrl, bounds);
      createInFlightRef.current = false;

      if (Result.isFailure(result)) {
        pendingBoundsRef.current = null;
        showSurfaceFailure(Result.unwrapError(result));
        return;
      }

      if (useUiStore.getState().browserUrl !== requestedUrl) {
        pendingBoundsRef.current = null;
        return;
      }

      webviewCreatedRef.current = true;
      const state = Result.unwrap(result);
      const previousState = browserStateRef.current;
      if (!previousState || (previousState.url === requestedUrl && (previousState.is_loading || !state.is_loading))) {
        browserStateRef.current = state;
        setBrowserState(state);
      }

      await flushPendingBounds(requestedUrl);
    },
    [captureLayoutDiagnostics, flushPendingBounds, showSurfaceFailure, syncBrowserBounds],
  );

  useEffect(() => {
    fallbackInFlightRef.current = false;
    webviewCreatedRef.current = false;
    createInFlightRef.current = false;
    pendingBoundsRef.current = null;

    if (!browserUrl) return undefined;

    setBrowserState((state) => {
      const nextState = state?.url === browserUrl ? state : initialBrowserState(browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });
    setSurfaceIssue(null);
  }, [browserUrl]);

  useLayoutEffect(() => {
    if (!browserUrl || !hostRef.current) {
      return undefined;
    }

    let cancelled = false;

    const syncBounds = (mode: "create" | "resize") => {
      void (listenerReadyRef.current ?? Promise.resolve()).then(() => {
        if (cancelled || useUiStore.getState().browserUrl !== browserUrl) {
          return;
        }

        void syncBrowserWebview(browserUrl, mode);
      });
    };

    syncBounds("create");

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            syncBounds("resize");
          });
    observer?.observe(hostRef.current);

    const handleResize = () => {
      syncBounds("resize");
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [browserUrl, syncBrowserWebview]);

  useLayoutEffect(() => {
    if (!browserUrl || !showDiagnostics) {
      return;
    }

    captureLayoutDiagnostics();
  }, [browserUrl, captureLayoutDiagnostics, showDiagnostics]);

  useEffect(() => {
    if (showDiagnostics) {
      return;
    }

    setLayoutDiagnostics(null);
    setNativeDiagnostics(null);
  }, [showDiagnostics]);

  useEffect(() => {
    return () => {
      void closeBrowserWebview().then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview:", error);
          }),
        );
      });
    };
  }, []);

  const isLoading = browserUrl ? (browserState?.is_loading ?? true) : false;

  useEffect(() => {
    if (!browserUrl || !isLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const activeUrl = useUiStore.getState().browserUrl;
      if (activeUrl !== browserUrl || !browserStateRef.current?.is_loading) {
        return;
      }

      showSurfaceFailure({
        type: "UserVisible",
        message: `Timed out waiting for embedded browser webview to finish loading: ${browserUrl}`,
      });
    }, BROWSER_WINDOW_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [browserUrl, isLoading, showSurfaceFailure]);

  useEffect(() => {
    if (!browserUrl) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      handleCloseOverlay();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [browserUrl, handleCloseOverlay]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!browserUrl) return null;

  const runtimeUnavailable =
    (typeof window !== "undefined" &&
      (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)) ||
    !hasTauriRuntime();
  const activeSurfaceIssue =
    surfaceIssue ??
    (runtimeUnavailable && !isLoading
      ? {
          kind: "unsupported",
          title: t("browser_embed_browser_mode"),
          description: t("browser_embed_browser_mode_hint"),
          detail: null,
          canRetry: false,
        }
      : null);

  const handleRetry = () => {
    fallbackInFlightRef.current = false;
    webviewCreatedRef.current = false;
    createInFlightRef.current = false;
    pendingBoundsRef.current = null;
    setSurfaceIssue(null);
    const nextState = initialBrowserState(browserUrl);
    browserStateRef.current = nextState;
    setBrowserState(nextState);
    void syncBrowserWebview(browserUrl, "create");
  };

  const handleOpenExternal = async () => {
    const result = await openInBrowser(browserUrl, false);
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open preview in external browser:", error);
        showToast(error.message);
      }),
    );
  };

  const geometry = resolveBrowserViewerGeometry({
    scope,
    viewportWidth,
    diagnosticsVisible: showDiagnostics,
  });
  const isCompactViewer = geometry.compact;
  const closeButtonClass = isCompactViewer
    ? "pointer-events-auto size-10 rounded-[12px] border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto size-[46px] rounded-[13px] border border-white/12 bg-black/30 text-white/96 shadow-[0_12px_30px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/44 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] focus-visible:border-white/22 focus-visible:bg-black/48 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/54 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
  const actionButtonClass = isCompactViewer
    ? "pointer-events-auto size-10 rounded-[12px] border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto size-[46px] rounded-[13px] border border-white/12 bg-black/26 text-white/94 shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/40 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.28)] focus-visible:border-white/22 focus-visible:bg-black/44 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/50 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
  const stageClass =
    scope === "main-stage"
      ? "absolute z-10 overflow-hidden bg-background"
      : "absolute z-10 overflow-hidden border border-white/6 bg-background shadow-[0_20px_48px_rgba(0,0,0,0.24)]";

  const overlay = (
    <div
      ref={overlayRef}
      data-testid="browser-overlay-shell"
      className="pointer-events-auto absolute inset-0 z-20 isolate overflow-hidden bg-black/88 backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.885)_16%,rgba(0,0,0,0.87)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_15rem_at_10rem_0.5rem,rgba(255,255,255,0.04),transparent_58%)]"
      />
      {showDiagnostics ? (
        <BrowserDiagnosticsRail
          layoutDiagnostics={layoutDiagnostics}
          nativeDiagnostics={nativeDiagnostics}
          compact={geometry.diagnostics.compact}
          top={geometry.diagnostics.top}
        />
      ) : null}
      {geometry.chromeRail.visible ? (
        <div
          aria-hidden="true"
          data-testid="browser-overlay-top-rail"
          style={{
            left: `${geometry.chromeRail.left}px`,
            right: `${geometry.chromeRail.right}px`,
            top: `${geometry.chromeRail.top}px`,
            height: `${geometry.chromeRail.height}px`,
            borderRadius: `${geometry.chromeRail.radius}px`,
          }}
          className="pointer-events-none absolute z-[50] border border-white/7 bg-white/[0.035] shadow-[0_14px_32px_rgba(0,0,0,0.24)] backdrop-blur-md"
        />
      ) : null}
      <div
        aria-hidden="true"
        data-testid="browser-overlay-scrim"
        className="absolute inset-0 z-0 cursor-default bg-transparent"
        onClick={scope === "main-stage" ? undefined : handleCloseOverlay}
      />
      <div
        data-testid="browser-overlay-chrome"
        style={{ left: `${geometry.chrome.close.left}px`, top: `${geometry.chrome.close.top}px` }}
        className="pointer-events-none absolute z-[60]"
      >
        <IconToolbarButton
          label={labels.closeOverlay}
          onClick={handleCloseOverlay}
          autoFocus
          className={closeButtonClass}
        >
          <X aria-hidden="true" className="size-4" />
        </IconToolbarButton>
      </div>
      <div
        style={{ right: `${geometry.chrome.action.right}px`, top: `${geometry.chrome.action.top}px` }}
        className="pointer-events-none absolute z-[60]"
      >
        <IconToolbarButton
          label={t("open_in_external_browser")}
          onClick={() => {
            void handleOpenExternal();
          }}
          className={actionButtonClass}
        >
          <ExternalLink className="h-4 w-4" />
        </IconToolbarButton>
      </div>
      <div
        ref={stageRef}
        data-testid="browser-overlay-stage"
        className={stageClass}
        style={{
          left: `${geometry.stage.left}px`,
          top: `${geometry.stage.top}px`,
          right: `${geometry.stage.right}px`,
          bottom: `${geometry.stage.bottom}px`,
          borderRadius: `${geometry.stage.radius}px`,
        }}
      >
        <div
          ref={hostRef}
          data-testid="browser-webview-host"
          className="absolute bg-background"
          style={{
            left: `${geometry.host.left}px`,
            top: `${geometry.host.top}px`,
            right: `${geometry.host.right}px`,
            bottom: `${geometry.host.bottom}px`,
          }}
        />
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-2xl border border-white/10 bg-black/58 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md">
              <div className="flex items-center justify-center gap-2 text-white">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                <p className="text-sm font-semibold">{t("browser_loading")}</p>
              </div>
              <p className="mt-2 text-sm text-white/72">{t("browser_loading_hint")}</p>
            </div>
          </div>
        ) : null}
        {activeSurfaceIssue ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div
              data-testid="browser-surface-state"
              className="max-w-md rounded-2xl border border-white/10 bg-black/62 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md"
            >
              <div className="flex items-center justify-center gap-2 text-white">
                <CircleAlert aria-hidden="true" className="size-4 text-orange-300" />
                <p className="text-sm font-semibold">{activeSurfaceIssue.title}</p>
              </div>
              <p className="mt-2 text-sm text-white/72">{activeSurfaceIssue.description}</p>
              {activeSurfaceIssue.detail ? (
                <p className="mt-3 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-left text-xs text-white/68">
                  {activeSurfaceIssue.detail}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {activeSurfaceIssue.canRetry ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("retry_web_preview")}
                  </Button>
                ) : null}
                <Button type="button" variant="secondary" size="sm" onClick={handleOpenExternal}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("open_in_external_browser")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (scope === "main-stage" && typeof document !== "undefined") {
    const portalTarget = document.querySelector<HTMLElement>("[data-browser-overlay-root]");
    if (portalTarget) {
      return createPortal(overlay, portalTarget);
    }
  }

  return overlay;
}
