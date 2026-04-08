import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { CircleAlert, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { BROWSER_WINDOW_EVENTS, BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";
import { readDevIntent } from "@/lib/dev-intent";
import { hasTauriRuntime } from "@/lib/window-chrome";
import { useUiStore } from "@/stores/ui-store";
import { BrowserOverlayChrome } from "./browser-overlay-chrome";

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
  hostLogical: BrowserWebviewBounds;
  stage: BrowserWebviewBounds;
  lane: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
};

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
  context?: {
    modeLabel: string;
    title: string;
    feedName?: string;
    publishedLabel?: string;
  };
};

function BrowserPreviewContext({
  scope,
  context,
}: {
  scope: "content-pane" | "main-stage";
  context: NonNullable<BrowserViewProps["context"]>;
}) {
  const positionClass = scope === "main-stage" ? "left-14 right-4 top-3" : "left-14 right-4 top-3";
  const hasMeta = Boolean(context.feedName || context.publishedLabel);

  return (
    <div
      data-testid="browser-preview-context"
      className={`pointer-events-none absolute ${positionClass} z-30 flex justify-start`}
    >
      <div className="max-w-full rounded-2xl border border-white/10 bg-black/42 px-4 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-md">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-white/62 uppercase">{context.modeLabel}</p>
        <p className="mt-1 max-w-[42rem] truncate text-sm font-semibold text-white sm:text-[15px]">{context.title}</p>
        {hasMeta ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/72">
            {context.feedName ? <span className="truncate">{context.feedName}</span> : null}
            {context.feedName && context.publishedLabel ? <span aria-hidden="true">•</span> : null}
            {context.publishedLabel ? <span>{context.publishedLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels, context }: BrowserViewProps) {
  const { t } = useTranslation("reader");
  const devIntent = readDevIntent();
  const showDiagnostics = devIntent === "image-viewer-overlay" && import.meta.env.VITE_ULTRA_RSS_DEV_BOUNDS_HUD === "1";
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

  const handleCloseOverlay = useCallback(() => {
    onCloseOverlay();
  }, [onCloseOverlay]);

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

      if (showDiagnostics) {
        const overlayRect = overlayRef.current?.getBoundingClientRect();
        const stageRect = stageRef.current?.getBoundingClientRect();
        const stageBounds = stageRect ? toBrowserWebviewBounds(stageRect) : null;
        if (overlayRect && stageRect && stageBounds) {
          setLayoutDiagnostics({
            hostLogical: bounds,
            stage: stageBounds,
            lane: {
              left: Math.round(stageRect.left - overlayRect.left),
              top: Math.round(stageRect.top - overlayRect.top),
              right: Math.round(overlayRect.right - stageRect.right),
              bottom: Math.round(overlayRect.bottom - stageRect.bottom),
            },
          });
        }
      }

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
    [flushPendingBounds, showDiagnostics, showSurfaceFailure, syncBrowserBounds],
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

  if (!browserUrl) return null;

  const runtimeUnavailable =
    (typeof window !== "undefined" && window.__ULTRA_RSS_BROWSER_MOCKS__ === true) || !hasTauriRuntime();
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

  const overlayChromePositionClass = "left-2 top-2";
  // Keep a dedicated close-button lane outside the native surface so the stage
  // never competes with the affordance again.
  const stageClass =
    scope === "main-stage"
      ? "absolute bottom-2 left-14 right-2 top-14 z-0 rounded-none border border-white/6 bg-background shadow-[0_24px_60px_rgba(0,0,0,0.24)]"
      : context
        ? "absolute inset-x-0 bottom-0 top-14 rounded-none border border-white/6 bg-background"
        : "absolute inset-0 rounded-none border border-white/6 bg-background";

  const overlay = (
    <div
      ref={overlayRef}
      data-testid="browser-overlay-shell"
      className="pointer-events-auto absolute inset-0 z-20 isolate flex items-center justify-center overflow-hidden bg-black/88 backdrop-blur-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.885)_16%,rgba(0,0,0,0.87)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_15rem_at_10rem_0.5rem,rgba(255,255,255,0.04),transparent_58%)]"
      />
      {showDiagnostics && (layoutDiagnostics || nativeDiagnostics) ? (
        <div
          data-testid="browser-overlay-diagnostics"
          className="pointer-events-none absolute bottom-4 left-4 z-30 max-w-[28rem] rounded-lg bg-black/80 px-3 py-2 font-mono text-[11px] leading-5 text-white shadow-xl"
        >
          {layoutDiagnostics ? (
            <>
              <div>
                host logical: {layoutDiagnostics.hostLogical.x},{layoutDiagnostics.hostLogical.y}{" "}
                {layoutDiagnostics.hostLogical.width}x{layoutDiagnostics.hostLogical.height}
              </div>
              <div>
                stage: {layoutDiagnostics.stage.x},{layoutDiagnostics.stage.y} {layoutDiagnostics.stage.width}x
                {layoutDiagnostics.stage.height}
              </div>
              <div>
                lane: L{layoutDiagnostics.lane.left} T{layoutDiagnostics.lane.top} R{layoutDiagnostics.lane.right} B
                {layoutDiagnostics.lane.bottom}
              </div>
            </>
          ) : null}
          {nativeDiagnostics ? (
            <>
              <div>
                rust requested: {nativeDiagnostics.requestedLogical.x},{nativeDiagnostics.requestedLogical.y}{" "}
                {nativeDiagnostics.requestedLogical.width}x{nativeDiagnostics.requestedLogical.height}
              </div>
              <div>
                rust applied: {nativeDiagnostics.appliedLogical.x},{nativeDiagnostics.appliedLogical.y}{" "}
                {nativeDiagnostics.appliedLogical.width}x{nativeDiagnostics.appliedLogical.height}
              </div>
              <div>rust action: {nativeDiagnostics.action}</div>
              <div>scale: {nativeDiagnostics.scaleFactor}</div>
              <div>
                native webview:{" "}
                {nativeDiagnostics.nativeWebviewBounds
                  ? `${nativeDiagnostics.nativeWebviewBounds.x},${nativeDiagnostics.nativeWebviewBounds.y} ${nativeDiagnostics.nativeWebviewBounds.width}x${nativeDiagnostics.nativeWebviewBounds.height}`
                  : "n/a"}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      <BrowserOverlayChrome
        closeLabel={labels.closeOverlay}
        onClose={handleCloseOverlay}
        className={overlayChromePositionClass}
        autoFocus
      />
      {context ? <BrowserPreviewContext scope={scope} context={context} /> : null}
      <div ref={stageRef} data-testid="browser-overlay-stage" className={stageClass}>
        <div ref={hostRef} data-testid="browser-webview-host" className="h-full w-full bg-background" />
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
