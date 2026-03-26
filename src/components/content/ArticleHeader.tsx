import type { ArticleDto } from "../../api/tauri-commands";

export function ArticleHeader({ article }: { article: ArticleDto }) {
  const date = new Date(article.published_at);
  return (
    <div style={{ marginBottom: "var(--space-content)" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          marginBottom: "var(--space-sm)",
        }}
      >
        {date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
      <h1
        style={{
          fontSize: "var(--font-size-title)",
          fontWeight: "bold",
          lineHeight: 1.3,
          marginBottom: "var(--space-sm)",
        }}
      >
        {article.title}
      </h1>
      {article.author && (
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>{article.author}</div>
      )}
    </div>
  );
}
