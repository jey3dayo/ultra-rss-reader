import { ArrowLeft, ExternalLink } from "lucide-react";
import { openInBrowser } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

export function BrowserView() {
  const { browserUrl, closeBrowser } = useUiStore();
  if (!browserUrl) return null;

  const handleOpenExternal = () => {
    openInBrowser(browserUrl);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex h-12 items-center gap-3 border-b border-border px-4">
        <button
          type="button"
          onClick={closeBrowser}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 truncate text-xs text-muted-foreground">{browserUrl}</span>
        <button
          type="button"
          onClick={handleOpenExternal}
          className="rounded p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
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
