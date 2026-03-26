import { openInBrowser } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";
import { IconButton } from "../IconButton";

export function BrowserView() {
  const { browserUrl, closeBrowser } = useUiStore();
  if (!browserUrl) return null;

  const handleOpenExternal = () => {
    openInBrowser(browserUrl);
  };

  return (
    <div
      style={{
        background: "var(--bg-content)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: "var(--toolbar-height)",
          padding: "0 var(--space-lg)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-md)",
          borderBottom: "1px solid var(--border-divider)",
        }}
      >
        <IconButton onClick={closeBrowser}>←</IconButton>
        <span
          style={{
            flex: 1,
            fontSize: "var(--font-size-xs)",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {browserUrl}
        </span>
        <IconButton onClick={handleOpenExternal}>↗</IconButton>
      </div>
      <iframe
        src={browserUrl}
        title="Browser View"
        style={{ flex: 1, border: "none", width: "100%", background: "#fff" }}
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  );
}
