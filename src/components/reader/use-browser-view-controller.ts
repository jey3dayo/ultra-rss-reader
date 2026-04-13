import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AppError,
  type BrowserWebviewState,
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  openInBrowser,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS, BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";
import { resolveBrowserViewerGeometry } from "@/lib/browser-viewer-geometry";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";
import { hasTauriRuntime } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "./browser-surface-issue";
import {
  type BrowserWebviewFallbackPayload,
  initialBrowserState,
  isMissingEmbeddedBrowserWebviewError,
  mergeBrowserState,
} from "./browser-webview-state";
import { useBrowserDebugGeometryEvents } from "./use-browser-debug-geometry-events";

type BrowserWebviewDiagnosticsPayload = BrowserDebugGeometryNativeDiagnostics;

type BrowserViewLayoutDiagnostics = BrowserDebugGeometryLayoutDiagnostics;

type BrowserViewGeometry = ReturnType<typeof resolveBrowserViewerGeometry>;

export type BrowserViewController = {
  browserUrl: string | null;
  showDiagnostics: boolean;
  geometry: BrowserViewGeometry;
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
  isLoading: boolean;
  handleCloseOverlay: () => void;
  handleRetry: () => void;
  handleOpenExternal: () => Promise<void>;
  closeButtonClass: string;
  actionButtonClass: string;
  stageClass: string;
  hostRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
};

export function useBrowserViewController({
  scope,
  onCloseOverlay,
}: {
  scope: "content-pane" | "main-stage";
  onCloseOverlay: () => void;
}): BrowserViewController {
  const prefs = usePreferencesStore((s) => s.prefs);
  const { t } = useTranslation("reader");
  const showDiagnostics = resolvePreferenceValue(prefs, "debug_browser_hud") === "true";
  const browserUrl = useUiStore((s) => s.browserUrl);
  const showToast = useUiStore((s) => s.showToast);
  const platformKind = usePlatformStore((state) => state.platform.kind);
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

  const handleLostEmbeddedBrowserWebview = useCallback(
    (error: AppError) => {
      console.warn("Embedded browser webview disappeared while overlay was open:", error.message);
      fallbackInFlightRef.current = false;
      webviewCreatedRef.current = false;
      createInFlightRef.current = false;
      pendingBoundsRef.current = null;
      browserStateRef.current = null;
      setBrowserState(null);
      setSurfaceIssue(null);
      handleCloseOverlay();
    },
    [handleCloseOverlay],
  );

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
      setSurfaceIssue(
        createBrowserSurfaceFailure(error.message, {
          failed: t("browser_embed_failed"),
          failedHint: t("browser_embed_failed_hint"),
        }),
      );
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
        setSurfaceIssue(
          createBrowserSurfaceFallback(payload.error_message, {
            failed: t("browser_embed_failed"),
            failedHint: t("browser_embed_failed_hint"),
            blocked: t("browser_embed_blocked"),
            blockedHint: t("browser_embed_blocked_hint"),
          }),
        );
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
        handleCloseOverlay();
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
  }, [handleCloseOverlay, showDiagnostics, t]);

  useBrowserDebugGeometryEvents({
    showDiagnostics,
    layoutDiagnostics,
    nativeDiagnostics,
  });

  const syncBrowserBounds = useCallback(
    async (bounds: BrowserWebviewBounds) => {
      const result = await setBrowserWebviewBounds(bounds);
      if (Result.isFailure(result)) {
        const error = Result.unwrapError(result);
        console.error("Failed to sync embedded browser bounds:", error);
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          handleLostEmbeddedBrowserWebview(error);
        }
      }
    },
    [handleLostEmbeddedBrowserWebview],
  );

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
      const usePhysicalBounds = platformKind === "windows";
      const bounds = rect
        ? toBrowserWebviewBounds(rect, {
            unit: usePhysicalBounds ? "physical" : "logical",
          })
        : null;
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
    [captureLayoutDiagnostics, flushPendingBounds, platformKind, showSurfaceFailure, syncBrowserBounds],
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

    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="browser-overlay-chrome"] button')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      handleCloseOverlay();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
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

  const runtimeUnavailable =
    (typeof window !== "undefined" &&
      (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)) ||
    !hasTauriRuntime();
  const activeSurfaceIssue =
    surfaceIssue ??
    resolveRuntimeUnavailableSurfaceIssue({
      runtimeUnavailable,
      isLoading,
      labels: {
        browserMode: t("browser_embed_browser_mode"),
        browserModeHint: t("browser_embed_browser_mode_hint"),
      },
    });

  const handleRetry = useCallback(() => {
    fallbackInFlightRef.current = false;
    webviewCreatedRef.current = false;
    createInFlightRef.current = false;
    pendingBoundsRef.current = null;
    setSurfaceIssue(null);
    const nextState = initialBrowserState(browserUrl ?? "");
    browserStateRef.current = nextState;
    setBrowserState(nextState);
    void syncBrowserWebview(browserUrl ?? "", "create");
  }, [browserUrl, syncBrowserWebview]);

  const handleOpenExternal = useCallback(async () => {
    if (!browserUrl) {
      return;
    }

    const result = await openInBrowser(browserUrl, false);
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open preview in external browser:", error);
        showToast(error.message);
      }),
    );
  }, [browserUrl, showToast]);

  const geometry = useMemo(
    () =>
      resolveBrowserViewerGeometry({
        scope,
        viewportWidth,
        diagnosticsVisible: showDiagnostics,
      }),
    [scope, showDiagnostics, viewportWidth],
  );
  const isCompactViewer = geometry.compact;
  const closeButtonClass = isCompactViewer
    ? "pointer-events-auto border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto border border-white/12 bg-black/30 text-white/96 shadow-[0_12px_30px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/44 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.3)] focus-visible:border-white/22 focus-visible:bg-black/48 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/54 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
  const actionButtonClass = isCompactViewer
    ? "pointer-events-auto border border-white/10 bg-black/32 text-white/92 shadow-[0_10px_26px_rgba(0,0,0,0.34)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/18 hover:bg-white/12 hover:text-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)] focus-visible:border-white/18 focus-visible:bg-white/14 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/18 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/20 active:bg-white/18 active:shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
    : "pointer-events-auto border border-white/12 bg-black/26 text-white/94 shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-white/20 hover:bg-black/40 hover:text-white hover:shadow-[0_14px_32px_rgba(0,0,0,0.28)] focus-visible:border-white/22 focus-visible:bg-black/44 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-0 active:scale-[0.97] active:border-white/22 active:bg-black/50 active:shadow-[0_10px_20px_rgba(0,0,0,0.24)]";
  const stageClass =
    scope === "main-stage"
      ? "absolute z-10 overflow-hidden bg-background"
      : "absolute z-10 overflow-hidden border border-white/6 bg-background shadow-[0_20px_48px_rgba(0,0,0,0.24)]";

  return {
    browserUrl,
    showDiagnostics,
    geometry,
    layoutDiagnostics,
    nativeDiagnostics,
    activeSurfaceIssue,
    isLoading,
    handleCloseOverlay,
    handleRetry,
    handleOpenExternal,
    closeButtonClass,
    actionButtonClass,
    stageClass,
    hostRef,
    overlayRef,
    stageRef,
  } as const;
}
