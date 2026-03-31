import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AppError,
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
const browserWebviewClosedEvent = "browser-webview-closed";
export const BROWSER_WINDOW_LOAD_TIMEOUT_MS = 10_000;

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

export function BrowserView() {
  const { t } = useTranslation("reader");
  const browserUrl = useUiStore((s) => s.browserUrl);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const showToast = useUiStore((s) => s.showToast);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const browserStateRef = useRef<BrowserWebviewState | null>(null);
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const unlistenRef = useRef<Array<() => void>>([]);
  const fallbackInFlightRef = useRef(false);

  const fallbackToExternalBrowser = useCallback(
    async (url: string, error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open dedicated browser window:", error);
      const fallbackResult = await openInBrowser(url, false);

      Result.pipe(
        fallbackResult,
        Result.inspect(() => {
          showToast(t("browser_window_fallback"));
        }),
        Result.inspectError((fallbackError) => {
          console.error("Failed to open fallback external browser:", fallbackError);
          showToast(fallbackError.message);
        }),
      );

      closeBrowser();
    },
    [closeBrowser, showToast, t],
  );

  useLayoutEffect(() => {
    let cancelled = false;

    listenerReadyRef.current = Promise.all([
      listen<BrowserWebviewState>(browserWebviewStateChangedEvent, ({ payload }) => {
        if (cancelled) return;
        const nextState = mergeBrowserState(browserStateRef.current, payload, useUiStore.getState().browserUrl ?? "");
        browserStateRef.current = nextState;
        setBrowserState(nextState);
      }),
      listen(browserWebviewClosedEvent, () => {
        if (cancelled) return;
        useUiStore.getState().closeBrowser();
      }),
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
  }, []);

  const syncBrowserWindow = useCallback(
    async (requestedUrl: string) => {
      const result = await createOrUpdateBrowserWebview(requestedUrl);

      Result.pipe(
        result,
        Result.inspect((state) => {
          if (useUiStore.getState().browserUrl !== requestedUrl) {
            return;
          }

          const previousState = browserStateRef.current;
          if (
            previousState &&
            (previousState.url !== requestedUrl || (!previousState.is_loading && state.is_loading))
          ) {
            return;
          }

          browserStateRef.current = state;
          setBrowserState(state);
        }),
        Result.inspectError(async (error) => {
          await fallbackToExternalBrowser(requestedUrl, error);
        }),
      );
    },
    [fallbackToExternalBrowser],
  );

  useEffect(() => {
    let cancelled = false;

    fallbackInFlightRef.current = false;

    if (!browserUrl) return undefined;

    setBrowserState((state) => {
      const nextState = state?.url === browserUrl ? state : initialBrowserState(browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });

    void (listenerReadyRef.current ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      void syncBrowserWindow(browserUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [browserUrl, syncBrowserWindow]);

  useEffect(() => {
    return () => {
      void closeBrowserWebview().then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close browser window:", error);
          }),
        );
      });
    };
  }, []);

  const currentUrl = browserState?.url ?? browserUrl ?? "";
  const canGoBack = browserState?.can_go_back ?? false;
  const canGoForward = browserState?.can_go_forward ?? false;
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

      void fallbackToExternalBrowser(browserUrl, {
        type: "UserVisible",
        message: `Timed out waiting for dedicated browser window to finish loading: ${browserUrl}`,
      });
    }, BROWSER_WINDOW_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [browserUrl, fallbackToExternalBrowser, isLoading]);

  if (!browserUrl) return null;

  const handleOpenExternal = async () => {
    const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
    Result.pipe(
      await openInBrowser(currentUrl, bg),
      Result.inspectError((error) => console.error("Failed to open in browser:", error)),
    );
  };

  const handleBrowserCommand = async (command: () => Promise<Result.Result<BrowserWebviewState, AppError>>) => {
    const result = await command();
    Result.pipe(
      result,
      Result.inspect((state) => {
        browserStateRef.current = state;
        setBrowserState(state);
      }),
      Result.inspectError(async (error) => {
        await fallbackToExternalBrowser(currentUrl, error);
      }),
    );
  };

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {t("browser_view")}
          </p>
          <p className="truncate text-sm text-foreground">{currentUrl}</p>
          <p className="text-xs text-muted-foreground">{isLoading ? t("browser_loading") : t("browser_window_hint")}</p>
          {isLoading && <p className="mt-1 text-xs text-muted-foreground">{t("browser_loading_hint")}</p>}
        </div>

        <TooltipProvider>
          <div className="flex items-center gap-1">
            <AppTooltip label={t("web_back")}>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canGoBack}
                onClick={() => {
                  void handleBrowserCommand(goBackBrowserWebview);
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
                onClick={() => {
                  void handleBrowserCommand(goForwardBrowserWebview);
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
                onClick={() => {
                  setBrowserState((state) => {
                    const nextState = state ? { ...state, is_loading: true } : initialBrowserState(browserUrl);
                    browserStateRef.current = nextState;
                    return nextState;
                  });
                  void handleBrowserCommand(reloadBrowserWebview);
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
            <AppTooltip label={t("close_browser_window")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeBrowser}
                className="text-muted-foreground"
                aria-label={t("close_browser_window")}
              >
                <X className="h-4 w-4" />
              </Button>
            </AppTooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
