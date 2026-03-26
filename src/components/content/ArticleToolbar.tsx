import type { ArticleDto } from "../../api/tauri-commands";
import { useMarkRead, useToggleStar } from "../../hooks/use-articles";
import { useUiStore } from "../../stores/ui-store";
import { IconButton } from "../IconButton";

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
      <IconButton
        onClick={() => markRead.mutate(article.id)}
        color={article.is_read ? "var(--text-muted)" : "var(--accent-blue)"}
      >
        ○
      </IconButton>
      <IconButton
        onClick={() => toggleStar.mutate({ id: article.id, starred: !article.is_starred })}
        color={article.is_starred ? "var(--accent-orange)" : "var(--text-muted)"}
      >
        ★
      </IconButton>
      {article.url && <IconButton onClick={() => openBrowser(article.url as string)}>BR</IconButton>}
    </div>
  );
}
