import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ExternalLink, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { checkBrowserEmbedSupport, openInBrowser } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useAccountArticles, useArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useArticlesByTag } from "@/hooks/use-tags";
import { resolveSelectedFeedDisplayMode } from "@/lib/article-view";
import { goBackInWebview, goForwardInWebview, reloadWebview } from "@/lib/webview-history";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function BrowserView() {
  const { t } = useTranslation("reader");
  const { browserUrl, closeBrowser } = useUiStore();
  const [isLoading, setIsLoading] = useState(true);
  const [embedBlocked, setEmbedBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const qc = useQueryClient();
  const selection = useUiStore((s) => s.selection);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const isWidescreen =
    resolveSelectedFeedDisplayMode({
      selectedArticleId,
      selectionFeedId: feedId,
      feedId,
      tagId,
      articles,
      accountArticles,
      tagArticles,
      feeds,
    }) === "widescreen";

  useEffect(() => {
    if (!browserUrl) return;
    setIsLoading(true);
    setEmbedBlocked(false);

    let cancelled = false;

    void checkBrowserEmbedSupport(browserUrl).then((result) => {
      if (cancelled) return;

      if (Result.isSuccess(result) && Result.unwrap(result) === false) {
        setEmbedBlocked(true);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [browserUrl]);

  if (!browserUrl) return null;

  const handleIframeLoad = () => {
    setIsLoading(false);

    try {
      const currentUrl = iframeRef.current?.contentWindow?.location.href;
      if (currentUrl?.startsWith("chrome-error://")) {
        setEmbedBlocked(true);
      }
    } catch {
      // Cross-origin frames are expected. Ignore and keep the embed visible.
    }
  };

  const handleOpenExternal = async () => {
    const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
    Result.pipe(
      await openInBrowser(browserUrl, bg),
      Result.inspectError((e) => console.error("Failed to open in browser:", e)),
    );
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border px-4">
        <TooltipProvider>
          <AppTooltip label={t("close_view")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeBrowser}
              className="text-muted-foreground"
              aria-label={t("close_view")}
            >
              <X className="h-4 w-4" />
            </Button>
          </AppTooltip>
        </TooltipProvider>
        <span className="flex-1 truncate text-xs text-muted-foreground">{browserUrl}</span>
        <TooltipProvider>
          <div className="flex items-center justify-end gap-2">
            <AppTooltip label={t("web_back")}>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  Result.pipe(
                    await goBackInWebview(),
                    Result.inspectError(() => {}),
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
                onClick={async () => {
                  Result.pipe(
                    await goForwardInWebview(),
                    Result.inspectError(() => {}),
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
                  Result.pipe(
                    await reloadWebview(),
                    Result.inspectError(() => {}),
                  );
                }}
                className="text-muted-foreground"
                aria-label={t("reload_page")}
              >
                <RotateCcw className="h-4 w-4" />
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

      {/* Iframe */}
      <div className="relative flex-1">
        {embedBlocked ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium text-foreground">{t("browser_embed_blocked")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("browser_embed_blocked_hint")}</p>
            <Button variant="outline" onClick={handleOpenExternal}>
              <ExternalLink className="h-4 w-4" />
              {t("open_in_external_browser")}
            </Button>
          </div>
        ) : (
          <>
            <iframe
              ref={iframeRef}
              src={browserUrl}
              title={t("browser_view")}
              className="h-full w-full border-none bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups"
              onLoad={handleIframeLoad}
              onError={() => {
                setEmbedBlocked(true);
                setIsLoading(false);
              }}
            />
            {isLoading && <div className="pointer-events-none absolute inset-0 bg-background/20" />}
          </>
        )}
      </div>
    </div>
  );
}
