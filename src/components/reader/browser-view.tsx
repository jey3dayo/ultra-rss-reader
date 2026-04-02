import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  type AppError,
  type BrowserWebviewState,
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS, BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";
import { readDevIntent } from "@/lib/dev-intent";
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

type BrowserViewProps = {
  scope?: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
  labels: {
    closeOverlay: string;
  };
};

export function BrowserView({ scope = "content-pane", onCloseOverlay, labels }: BrowserViewProps) {
  const { t } = useTranslation("reader");
  const devIntent = readDevIntent();
  const showDiagnostics = devIntent === "image-viewer-overlay" && import.meta.env.VITE_ULTRA_RSS_DEV_BOUNDS_HUD === "1";
  const browserUrl = useUiStore((s) => s.browserUrl);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
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

  const fallbackToReader = useCallback(
    async (_url: string, error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open embedded browser webview:", error);
      showToast(t("browser_embed_fallback"));
      closeBrowser();
    },
    [closeBrowser, showToast, t],
  );

  useLayoutEffect(() => {
    let cancelled = false;

    listenerReadyRef.current = Promise.all([
      listen<BrowserWebviewState>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
        if (cancelled) return;
        const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
        browserStateRef.current = nextState;
        setBrowserState(nextState);
      }),
      listen<BrowserWebviewFallbackPayload>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
        if (cancelled) return;
        if (payload.error_message) {
          showToast(payload.error_message);
        } else if (payload.opened_external) {
          showToast(t("browser_embed_fallback"));
        }
        useUiStore.getState().closeBrowser();
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
  }, [showDiagnostics, showToast, t]);

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
        await fallbackToReader(requestedUrl, Result.unwrapError(result));
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
    [fallbackToReader, flushPendingBounds, showDiagnostics, syncBrowserBounds],
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

      void fallbackToReader(browserUrl, {
        type: "UserVisible",
        message: `Timed out waiting for embedded browser webview to finish loading: ${browserUrl}`,
      });
    }, BROWSER_WINDOW_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [browserUrl, fallbackToReader, isLoading]);

  if (!browserUrl) return null;

  const overlayChromePositionClass = "left-2 top-2";
  // Keep a dedicated close-button lane outside the native surface so the stage
  // never competes with the affordance again.
  const stageClass =
    scope === "main-stage"
      ? "absolute bottom-2 left-12 right-2 top-12 rounded-none bg-background shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
      : "absolute inset-0 rounded-none bg-background";

  const overlay = (
    <div
      ref={overlayRef}
      data-testid="browser-overlay-shell"
      className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/88 backdrop-blur-sm"
    >
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
        onClose={onCloseOverlay}
        className={overlayChromePositionClass}
      />
      <div ref={stageRef} data-testid="browser-overlay-stage" className={stageClass}>
        <div ref={hostRef} data-testid="browser-webview-host" className="h-full w-full bg-background" />
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
