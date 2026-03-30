import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BrowserWebviewBounds,
  type BrowserWebviewState,
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  openInBrowser,
  reloadBrowserWebview,
} from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const browserWebviewStateChangedEvent = "browser-webview-state-changed";

function toBrowserWebviewBounds(element: HTMLElement): BrowserWebviewBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height)),
  };
}

function initialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
  };
}

function hasRenderableBrowserWebviewBounds(
  bounds: BrowserWebviewBounds | null,
): bounds is BrowserWebviewBounds {
  return bounds !== null && bounds.width > 0 && bounds.height > 0;
}

function mergeBrowserState(
  previousState: BrowserWebviewState | null,
  nextState: BrowserWebviewState,
  intendedUrl: string,
): BrowserWebviewState {
  if (!previousState) {
    return nextState;
  }

  // Ignore subresource/iframe loading transitions that momentarily replace the
  // main document URL after the top-level page already finished loading.
  if (!previousState.is_loading && nextState.is_loading && previousState.url !== nextState.url) {
    return {
      ...previousState,
      can_go_back: nextState.can_go_back,
      can_go_forward: nextState.can_go_forward,
    };
  }

  // Protect the user-intended top-level URL while the initial page load is
  // still in progress and subresources start navigating to unrelated URLs.
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

export function BrowserView() {
  const { t } = useTranslation("reader");
  const browserUrl = useUiStore((s) => s.browserUrl);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostBounds, setHostBounds] = useState<BrowserWebviewBounds | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const browserStateRef = useRef<BrowserWebviewState | null>(null);
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    listenerReadyRef.current = listen<BrowserWebviewState>(browserWebviewStateChangedEvent, ({ payload }) => {
      if (cancelled) return;
      const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
      browserStateRef.current = nextState;
      setBrowserState(nextState);
      setErrorMessage(null);
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      unlistenRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      unlistenRef.current?.();
      unlistenRef.current = null;
      listenerReadyRef.current = null;
    };
  }, []);

  const syncBrowserWebview = useCallback(async () => {
    if (!browserUrl || !hasRenderableBrowserWebviewBounds(hostBounds)) return;
    const requestedUrl = browserUrl;
    const requestedBounds = hostBounds;

    Result.pipe(
      await createOrUpdateBrowserWebview(requestedUrl, requestedBounds),
      Result.inspect((state) => {
        if (useUiStore.getState().browserUrl !== requestedUrl) {
          return;
        }
        const previousState = browserStateRef.current;
        if (previousState && (previousState.url !== requestedUrl || (!previousState.is_loading && state.is_loading))) {
          return;
        }
        browserStateRef.current = state;
        setBrowserState(state);
        setErrorMessage(null);
      }),
      Result.inspectError((error) => {
        console.error("Failed to create inline browser webview:", error);
        setErrorMessage(error.message);
      }),
    );
  }, [browserUrl, hostBounds]);

  useEffect(() => {
    let cancelled = false;

    if (!browserUrl) return undefined;

    setBrowserState((state) => {
      const nextState = state?.url === browserUrl ? state : initialBrowserState(browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });
    setErrorMessage(null);

    void (listenerReadyRef.current ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      void syncBrowserWebview();
    });

    return () => {
      cancelled = true;
    };
  }, [browserUrl, hostBounds, syncBrowserWebview]);

  useEffect(() => {
    if (!browserUrl || !hostRef.current) return;

    const element = hostRef.current;
    const updateBounds = () => {
      setHostBounds(toBrowserWebviewBounds(element));
    };

    updateBounds();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      updateBounds();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [browserUrl]);

  useEffect(() => {
    return () => {
      void closeBrowserWebview().then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close inline browser webview:", error);
          }),
        );
      });
    };
  }, []);

  if (!browserUrl) return null;

  const currentUrl = browserState?.url ?? browserUrl;
  const canGoBack = browserState?.can_go_back ?? false;
  const canGoForward = browserState?.can_go_forward ?? false;
  const isLoading = browserState?.is_loading ?? true;

  const handleOpenExternal = async () => {
    const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
    Result.pipe(
      await openInBrowser(currentUrl, bg),
      Result.inspectError((error) => console.error("Failed to open in browser:", error)),
    );
  };

  const handleClose = () => {
    closeBrowser();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div
        data-tauri-drag-region
        className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-4"
      >
        <TooltipProvider>
          <AppTooltip label={t("close_view")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="text-muted-foreground"
              aria-label={t("close_view")}
            >
              <X className="h-4 w-4" />
            </Button>
          </AppTooltip>
        </TooltipProvider>
        <span className="flex-1 truncate text-xs text-muted-foreground">{currentUrl}</span>
        <TooltipProvider>
          <div className="flex items-center justify-end gap-2">
            <AppTooltip label={t("web_back")}>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoBack}
                onClick={async () => {
                  Result.pipe(
                    await goBackBrowserWebview(),
                    Result.inspect((state) => {
                      browserStateRef.current = state;
                      setBrowserState(state);
                    }),
                    Result.inspectError((error) => {
                      console.error("Failed to navigate back in inline browser webview:", error);
                    }),
                  );
                }}
                className="text-muted-foreground"
                aria-label={t("web_back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </AppTooltip>
            <AppTooltip label={t("web_forward")}>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoForward}
                onClick={async () => {
                  Result.pipe(
                    await goForwardBrowserWebview(),
                    Result.inspect((state) => {
                      browserStateRef.current = state;
                      setBrowserState(state);
                    }),
                    Result.inspectError((error) => {
                      console.error("Failed to navigate forward in inline browser webview:", error);
                    }),
                  );
                }}
                className="text-muted-foreground"
                aria-label={t("web_forward")}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </AppTooltip>
            <AppTooltip label={t("reload_page")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  setBrowserState((state) => {
                    const nextState = state ? { ...state, is_loading: true } : initialBrowserState(browserUrl);
                    browserStateRef.current = nextState;
                    return nextState;
                  });
                  Result.pipe(
                    await reloadBrowserWebview(),
                    Result.inspect((state) => {
                      browserStateRef.current = state;
                      setBrowserState(state);
                    }),
                    Result.inspectError((error) => {
                      console.error("Failed to reload inline browser webview:", error);
                    }),
                  );
                }}
                className="text-muted-foreground"
                aria-label={t("reload_page")}
              >
                <RotateCcw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </AppTooltip>
            <AppTooltip label={t("open_in_external_browser")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenExternal}
                className="text-muted-foreground"
                aria-label={t("open_in_external_browser")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </AppTooltip>
          </div>
        </TooltipProvider>
      </div>

      {isLoading && (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <p>{t("browser_loading")}</p>
          <p>{t("browser_loading_hint")}</p>
        </div>
      )}

      <div ref={hostRef} className="relative flex-1">
        {errorMessage ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium text-foreground">{t("browser_embed_blocked")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={handleOpenExternal}>
              <ExternalLink className="h-4 w-4" />
              {t("open_in_external_browser")}
            </Button>
          </div>
        ) : (
          isLoading && <div className="pointer-events-none absolute inset-0 bg-background/20" />
        )}
      </div>
    </div>
  );
}
