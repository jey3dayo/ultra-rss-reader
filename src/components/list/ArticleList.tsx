import type { ArticleDto } from "../../api/tauri-commands";
import { ArticleRow } from "./ArticleRow";

export function ArticleList({ articles }: { articles: ArticleDto[] }) {
  if (articles.length === 0) {
    return (
      <div style={{ padding: "var(--space-xl)", color: "var(--text-muted)", textAlign: "center" }}>No articles</div>
    );
  }
  return (
    <div>
      {articles.map((a) => (
        <ArticleRow key={a.id} article={a} />
      ))}
    </div>
  );
}
