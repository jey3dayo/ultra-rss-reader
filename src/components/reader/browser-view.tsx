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
  setBrowserWebviewBounds,
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

export function BrowserView() {
  const { t } = useTranslation("reader");
  const browserUrl = useUiStore((s) => s.browserUrl);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const setBrowserUrl = useUiStore((s) => s.setBrowserUrl);
  const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<BrowserWebviewState>(browserWebviewStateChangedEvent, ({ payload }) => {
      if (cancelled) return;
      setBrowserState(payload);
      setBrowserUrl(payload.url);
      setErrorMessage(null);
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else unlisten = cleanup;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [setBrowserUrl]);

  const syncBrowserWebview = useCallback(async () => {
    if (!browserUrl || !hostRef.current) return;
    const requestedUrl = browserUrl;

    Result.pipe(
      await createOrUpdateBrowserWebview(requestedUrl, toBrowserWebviewBounds(hostRef.current)),
      Result.inspect((state) => {
        if (useUiStore.getState().browserUrl !== requestedUrl) {
          return;
        }
        setBrowserState(state);
        setBrowserUrl(state.url);
        setErrorMessage(null);
      }),
      Result.inspectError((error) => {
        console.error("Failed to create inline browser webview:", error);
        setErrorMessage(error.message);
      }),
    );
  }, [browserUrl, setBrowserUrl]);

  useLayoutEffect(() => {
    if (!browserUrl) return;
    if (browserState?.url === browserUrl) return;
    setBrowserState(initialBrowserState(browserUrl));
    setErrorMessage(null);
    void syncBrowserWebview();
  }, [browserState?.url, browserUrl, syncBrowserWebview]);

  useEffect(() => {
    if (!browserUrl || !hostRef.current) return;

    const element = hostRef.current;
    const updateBounds = () => {
      void setBrowserWebviewBounds(toBrowserWebviewBounds(element)).then((result) => {
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to update browser webview bounds:", error);
          }),
        );
      });
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
    void closeBrowserWebview().then((result) => {
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.error("Failed to close inline browser webview:", error);
        }),
      );
    });
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
                      setBrowserState(state);
                      setBrowserUrl(state.url);
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
                      setBrowserState(state);
                      setBrowserUrl(state.url);
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
                  setBrowserState((state) =>
                    state ? { ...state, is_loading: true } : initialBrowserState(browserUrl),
                  );
                  Result.pipe(
                    await reloadBrowserWebview(),
                    Result.inspect((state) => {
                      setBrowserState(state);
                      setBrowserUrl(state.url);
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
