import { Result } from "@praha/byethrow";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openInBrowser } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { useFeeds } from "@/hooks/use-feeds";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function BrowserView() {
  const { t } = useTranslation("reader");
  const { browserUrl, closeBrowser } = useUiStore();
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const isWidescreen = feedId && feeds ? feeds.find((f) => f.id === feedId)?.display_mode === "widescreen" : false;
  if (!browserUrl) return null;

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
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        {!isWidescreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={closeBrowser}
            className="text-muted-foreground"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <span className="flex-1 truncate text-xs text-muted-foreground">{browserUrl}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenExternal}
          className="text-muted-foreground"
          aria-label={t("open_in_external_browser")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Iframe */}
      <iframe
        src={browserUrl}
        title={t("browser_view")}
        className="flex-1 border-none bg-white"
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}
