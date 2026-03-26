import type { ArticleDto } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";

export function ArticleRow({ article }: { article: ArticleDto }) {
  const { selectedArticleId, selectArticle } = useUiStore();
  const isSelected = selectedArticleId === article.id;
  const time = new Date(article.published_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={() => selectArticle(article.id)}
      style={{
        padding: "var(--space-md) var(--space-lg)",
        display: "flex",
        gap: "var(--space-md)",
        cursor: "pointer",
        background: isSelected ? "var(--bg-selected)" : "transparent",
        borderBottom: "1px solid var(--border-divider)",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        opacity: article.is_read ? 0.6 : 1,
        width: "100%",
        textAlign: "left",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--font-size-md)",
            fontWeight: article.is_read ? "normal" : "bold",
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {article.title}
        </div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)", marginTop: 2 }}>{time}</div>
      </div>
      {article.thumbnail && (
        <img
          src={article.thumbnail}
          alt=""
          style={{ width: 48, height: 48, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      )}
    </button>
  );
}
