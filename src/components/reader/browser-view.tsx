import { Result } from "@praha/byethrow";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { openInBrowser } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

export function BrowserView() {
  const { browserUrl, closeBrowser } = useUiStore();
  if (!browserUrl) return null;

  const handleOpenExternal = async () => {
    Result.pipe(
      await openInBrowser(browserUrl),
      Result.inspectError((e) => console.error("Failed to open in browser:", e)),
    );
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <Button variant="ghost" size="icon" onClick={closeBrowser} className="text-muted-foreground" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 truncate text-xs text-muted-foreground">{browserUrl}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenExternal}
          className="text-muted-foreground"
          aria-label="Open in external browser"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Iframe */}
      <iframe
        src={browserUrl}
        title="Browser View"
        className="flex-1 border-none bg-white"
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}
