import type { ArticleDto } from "../../api/tauri-commands";
import { useMarkRead, useToggleStar } from "../../hooks/use-articles";
import { useUiStore } from "../../stores/ui-store";

export function ArticleToolbar({ article }: { article: ArticleDto }) {
  const markRead = useMarkRead();
  const toggleStar = useToggleStar();
  const openBrowser = useUiStore((s) => s.openBrowser);

  return (
    <div
      style={{
        height: "var(--toolbar-height)",
        padding: "0 var(--space-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "var(--space-lg)",
        borderBottom: "1px solid var(--border-divider)",
      }}
    >
      <button
        type="button"
        onClick={() => markRead.mutate(article.id)}
        style={{
          background: "none",
          border: "none",
          color: article.is_read ? "var(--text-muted)" : "var(--accent-blue)",
          cursor: "pointer",
        }}
      >
        ○
      </button>
      <button
        type="button"
        onClick={() => toggleStar.mutate({ id: article.id, starred: !article.is_starred })}
        style={{
          background: "none",
          border: "none",
          color: article.is_starred ? "var(--accent-orange)" : "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        ★
      </button>
      {article.url && (
        <button
          type="button"
          onClick={() => openBrowser(article.url as string)}
          style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}
        >
          BR
        </button>
      )}
    </div>
  );
}
